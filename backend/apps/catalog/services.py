"""
Règles métier du catalogue : soumission d'une œuvre, paiement de la publication, modération.

Les vues et l'administration appellent ces fonctions ; elles ne contiennent pas de règle métier.
"""
import logging

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import ArtistProfile, ArtistStatus
from apps.accounts.services import exclude_artist, red_list_artist
from apps.core.pricing import quote
from apps.notifications import services as notify

from .models import Artwork, ArtworkStatus, Gallery

logger = logging.getLogger("agapy.catalog")

NOT_FOUND_MESSAGE = "L'artiste recherché ne figure pas sur AGAPY-GALLERY."
ARTWORK_NOT_FOUND_MESSAGE = "L'œuvre recherchée ne figure pas sur AGAPY-GALLERY."

# Modifier l'un de ces champs sur une œuvre publiée la renvoie en modération
REVIEWED_FIELDS = {"title", "image"}


def visible_artists_q(prefix: str = "") -> Q:
    """Artistes visibles publiquement : compte ouvert et non exclu."""
    return ~Q(**{f"{prefix}status__in": [ArtistStatus.EXCLUDED, ArtistStatus.PENDING_PAYMENT]})


def public_artists():
    return ArtistProfile.objects.filter(visible_artists_q()).select_related("gallery")


def free_gallery_q(prefix: str = "") -> Q:
    today = timezone.localdate()
    return Q(**{f"{prefix}gallery__is_free": True}) & (
        Q(**{f"{prefix}gallery__free_until__isnull": True}) | Q(**{f"{prefix}gallery__free_until__gte": today})
    )


def name_q(words: list[str], prefix: str = "") -> Q:
    """Chaque mot doit apparaître dans l'un des noms de l'artiste."""
    q = Q()
    for word in words:
        q &= (Q(**{f"{prefix}artist_name__icontains": word}) | Q(**{f"{prefix}org_name__icontains": word})
              | Q(**{f"{prefix}first_names__icontains": word}) | Q(**{f"{prefix}last_name__icontains": word}))
    return q


def title_q(words: list[str], prefix: str = "") -> Q:
    q = Q()
    for word in words:
        q &= Q(**{f"{prefix}title__icontains": word})
    return q


def words_of(text: str) -> list[str]:
    return [w for w in (text or "").replace("'", " ").replace("’", " ").split() if w][:8]


# ---------------------------------------------------------------------------
# Espace artiste
# ---------------------------------------------------------------------------
def prepare_new_artwork(artist: ArtistProfile, data: dict) -> dict:
    """Valeurs par défaut d'une nouvelle œuvre : l'auteur est l'artiste du compte."""
    if not data.get("author_name"):
        data["author_name"] = artist.display_name
    if not data.get("author_contact"):
        data["author_contact"] = " / ".join(filter(None, [artist.user.phone_display, artist.user.email]))
    return data


def apply_artwork_changes(artwork: Artwork, changed: set[str]) -> None:
    """Après modification : une œuvre publiée dont l'image ou le titre change repasse en modération."""
    if artwork.status == ArtworkStatus.PUBLISHED and changed & REVIEWED_FIELDS:
        artwork.status = ArtworkStatus.PENDING_REVIEW
        artwork.submitted_at = timezone.now()
        artwork.save(update_fields=["status", "submitted_at", "updated_at"])


def check_can_publish(artist: ArtistProfile) -> None:
    if artist.status != ArtistStatus.ACTIVE:
        raise PermissionDenied(
            "Votre compte doit être actif pour publier (abonnement à renouveler ou compte fermé).",
            code="account_inactive",
        )
    if artist.is_red_listed:
        raise PermissionDenied(
            f"Vous êtes sur liste rouge jusqu'au {artist.red_listed_until:%d/%m/%Y} : "
            "vous ne pouvez pas publier de nouvelle œuvre.",
            code="red_listed",
        )


def check_artwork_submittable(artwork: Artwork) -> None:
    if artwork.status == ArtworkStatus.REMOVED:
        raise ValidationError({"detail": "Cette œuvre a été retirée par l'équipe AGAPY."}, code="artwork_removed")
    if artwork.status in (ArtworkStatus.PENDING_REVIEW, ArtworkStatus.PUBLISHED):
        raise ValidationError({"detail": "Cette œuvre est déjà soumise ou publiée."}, code="already_submitted")
    if not artwork.owner_certified:
        raise ValidationError({"owner_certified": ["Vous devez certifier être propriétaire de l'œuvre."]},
                              code="owner_certification_required")


def _to_review(artwork: Artwork) -> None:
    artwork.status = ArtworkStatus.PENDING_REVIEW
    artwork.submitted_at = timezone.now()
    artwork.moderation_reason = ""
    artwork.publication_settled = True
    artwork.save(update_fields=["status", "submitted_at", "moderation_reason", "publication_settled", "updated_at"])


@transaction.atomic
def submit_artwork(artwork: Artwork, method: str | None, user) -> dict:
    """
    Soumet une œuvre à la modération.

    - Publication déjà réglée (œuvre refusée puis corrigée, paiement reçu) ou publication gratuite
      de l'ouverture encore disponible : l'œuvre passe directement en attente de validation.
    - Sinon un paiement « publication » est créé et lancé ; l'œuvre attend le paiement.

    Renvoie {"artwork", "payment" (ou None), "action" (ou None), "free_publication"}.
    Peut lever ProviderError (moyen de paiement indisponible…).
    """
    from apps.payments import services as payments

    artist = artwork.artist
    check_can_publish(artist)
    check_artwork_submittable(artwork)

    if artwork.publication_settled:
        _to_review(artwork)
        return {"artwork": artwork, "payment": None, "action": None, "free_publication": False}

    gallery = Gallery.for_artist(artist)
    gallery = Gallery.objects.select_for_update().get(pk=gallery.pk)
    if not gallery.free_publication_used:
        gallery.free_publication_used = True
        gallery.save(update_fields=["free_publication_used", "updated_at"])
        _to_review(artwork)
        return {"artwork": artwork, "payment": None, "action": None, "free_publication": True}

    if not method:
        raise ValidationError({"method": ["Choisissez un moyen de paiement."]}, code="required")

    artwork.status = ArtworkStatus.AWAITING_PAYMENT
    artwork.save(update_fields=["status", "updated_at"])
    payment = payments.create_payment(
        purpose="publication", method=method, quote=quote("publication", artist.region),
        region=artist.region, artist=artist, payer_user=user, target=artwork,
    )
    action = payments.start_payment(payment)  # un paiement immédiat (Compte d'Avoir) confirme tout de suite
    artwork.refresh_from_db()
    payment.refresh_from_db()
    return {"artwork": artwork, "payment": payment, "action": action, "free_publication": False}


def publication_paid(payment) -> None:
    """Paiement de la publication confirmé : l'œuvre part en modération."""
    artwork = Artwork.objects.select_for_update().filter(pk=payment.target_id).first()
    if artwork is None or payment.target_type.model_class() is not Artwork:
        logger.warning("Paiement de publication sans œuvre : %s", payment.reference)
        return
    if artwork.status in (ArtworkStatus.AWAITING_PAYMENT, ArtworkStatus.DRAFT):
        _to_review(artwork)
    elif not artwork.publication_settled:
        artwork.publication_settled = True
        artwork.save(update_fields=["publication_settled", "updated_at"])


# ---------------------------------------------------------------------------
# Modération (équipe AGAPY)
# ---------------------------------------------------------------------------
def _notify(artist: ArtistProfile, subject: str, message: str) -> None:
    notify.send_sms(artist.user.phone, message)
    notify.send_email(artist.user.email, subject, message)


def approve_artwork(artwork: Artwork) -> None:
    now = timezone.now()
    artwork.status = ArtworkStatus.PUBLISHED
    artwork.moderation_reason = ""
    artwork.moderated_at = now
    artwork.published_at = artwork.published_at or now
    artwork.save(update_fields=["status", "moderation_reason", "moderated_at", "published_at", "updated_at"])
    _notify(artwork.artist, "Votre œuvre est publiée",
            f"AGAPY-GALLERY : votre œuvre « {artwork.title} » a été validée et est maintenant visible dans votre galerie.")


def reject_artwork(artwork: Artwork, reason: str) -> None:
    artwork.status = ArtworkStatus.REJECTED
    artwork.moderation_reason = reason
    artwork.moderated_at = timezone.now()
    artwork.save(update_fields=["status", "moderation_reason", "moderated_at", "updated_at"])
    _notify(artwork.artist, "Votre œuvre n'a pas été validée",
            f"AGAPY-GALLERY : votre œuvre « {artwork.title} » n'a pas été validée. Motif : {reason}. "
            "Vous pouvez la modifier puis la soumettre à nouveau sans payer une seconde fois.")




def _remove(artwork: Artwork, reason: str) -> None:
    artwork.status = ArtworkStatus.REMOVED
    artwork.moderation_reason = reason
    artwork.moderated_at = timezone.now()
    artwork.save(update_fields=["status", "moderation_reason", "moderated_at", "updated_at"])


@transaction.atomic
def remove_inappropriate(artwork: Artwork, reason: str):
    """Œuvre à scandale ou inappropriée : retirée sans remboursement, artiste sur liste rouge 3 mois."""
    _remove(artwork, reason)
    until = red_list_artist(artwork.artist)
    _notify(artwork.artist, "Votre œuvre a été retirée",
            f"AGAPY-GALLERY : votre œuvre « {artwork.title} » a été retirée (contenu inapproprié), sans remboursement. "
            f"Motif : {reason}. Vous ne pourrez pas publier de nouvelle œuvre avant le {until:%d/%m/%Y}.")
    return until


@transaction.atomic
def remove_stolen(artwork: Artwork, reason: str) -> None:
    """Œuvre volée : retirée et artiste exclu définitivement de la plateforme."""
    _remove(artwork, reason)
    _notify(artwork.artist, "Exclusion de AGAPY-GALLERY",
            f"AGAPY-GALLERY : l'œuvre « {artwork.title} » a été retirée (œuvre volée). "
            f"Motif : {reason}. Votre compte est définitivement fermé.")
    exclude_artist(artwork.artist)


# ---------------------------------------------------------------------------
# Recherche publique
# ---------------------------------------------------------------------------
def search(q: str = "", artist: str = "", title: str = "", limit: int = 24) -> dict:
    """
    Recherche par nom d'artiste, par titre d'œuvre, ou les deux combinés (p. 11).
    Renvoie {"artists", "artworks", "found", "code", "detail"}.
    """
    artists = public_artists()
    artworks = Artwork.objects.visible().select_related("artist")
    code = detail = ""

    if q:
        words = words_of(q)
        artists = artists.filter(name_q(words))
        artworks = artworks.filter(title_q(words) | name_q(words, "artist__"))
        if not artists.exists() and not artworks.exists():
            code, detail = "artist_not_found", NOT_FOUND_MESSAGE
    else:
        if artist:
            artists = artists.filter(name_q(words_of(artist)))
            artworks = artworks.filter(artist__in=artists)
            if not artists.exists():
                code, detail = "artist_not_found", NOT_FOUND_MESSAGE
        if title and not code:
            artworks = artworks.filter(title_q(words_of(title)))
            if not artworks.exists():
                code, detail = "artwork_not_found", ARTWORK_NOT_FOUND_MESSAGE
            elif not artist:
                artists = artists.filter(pk__in=artworks.values("artist_id"))

    if code:
        return {"artists": [], "artworks": [], "found": False, "code": code, "detail": detail}
    artists = list(artists.distinct()[:limit])
    artworks = list(artworks.distinct()[:limit])
    return {"artists": artists, "artworks": artworks, "found": bool(artists or artworks), "code": "", "detail": ""}
