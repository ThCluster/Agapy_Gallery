"""
Accès aux fichiers pleine résolution des œuvres (image, extrait audio/vidéo).

Règle : la pleine résolution n'est servie que si
  - la galerie de l'artiste est en visite gratuite aujourd'hui (apps.payments.services.gallery_is_free), ou
  - la requête porte un droit de visite valide pour CET artiste (en-tête X-Visit-Token ou ?visit_token=), ou
  - le demandeur est l'artiste propriétaire ou un membre de l'équipe (staff) : connecté (Bearer, session
    pour l'administration) ou porteur d'une URL signée (?sig=) que l'API lui a remise.

Les miniatures (Artwork.thumbnail) restent publiques.
"""
from urllib.parse import urlencode

from django.core import signing
from django.urls import reverse

from apps.payments import services as payments

VISIT_TOKEN_HEADER = "X-Visit-Token"
VISIT_TOKEN_PARAM = "visit_token"
SIGNATURE_PARAM = "sig"
# Durée de validité des URL signées remises à l'artiste propriétaire et au staff
SIGNED_URL_MAX_AGE = 6 * 3600
_SIGNER_SALT = "apps.catalog.access.media"

KINDS = ("image", "excerpt")


def visit_token_of(request) -> str:
    """Jeton de visite de la requête : en-tête X-Visit-Token, sinon paramètre ?visit_token=."""
    if request is None:
        return ""
    token = request.headers.get(VISIT_TOKEN_HEADER) or request.GET.get(VISIT_TOKEN_PARAM) or ""
    return token.strip()[:128]


def _user_of(request):
    user = getattr(request, "user", None)
    return user if user is not None and user.is_authenticated else None


def is_owner_or_staff(request, artwork) -> bool:
    user = _user_of(request)
    if user is None:
        return False
    if user.is_staff:
        return True
    artist = getattr(user, "artist", None)
    return artist is not None and artist.pk == artwork.artist_id


def visit_status(request, artist) -> str:
    """
    Droit de visite de la requête pour cet artiste : "free" (galerie gratuite), "granted" (jeton valide),
    "missing" (aucun jeton) ou "invalid" (jeton invalide, expiré ou d'un autre artiste).
    Mémorisé sur la requête : une liste d'œuvres ne vérifie le jeton qu'une fois par artiste.
    """
    token = visit_token_of(request)
    cache = None
    if request is not None:
        cache = getattr(request, "_agapy_visit_status", None)
        if cache is None:
            cache = {}
            try:
                request._agapy_visit_status = cache
            except AttributeError:
                cache = None
    key = (artist.pk, token)
    if cache is not None and key in cache:
        return cache[key]
    try:
        result = payments.check_visit_access(artist, token or None)
        status = ("free" if result["free"] else "granted") if result["access"] else "missing"
    except payments.PaymentError:
        status = "invalid"
    if cache is not None:
        cache[key] = status
    return status


def _sign(slug: str, kind: str) -> str:
    return signing.TimestampSigner(salt=_SIGNER_SALT).sign(f"{kind}:{slug}")


def signature_valid(value: str, slug: str, kind: str) -> bool:
    if not value:
        return False
    try:
        return signing.TimestampSigner(salt=_SIGNER_SALT).unsign(value, max_age=SIGNED_URL_MAX_AGE) == f"{kind}:{slug}"
    except signing.BadSignature:
        return False


def access_reason(request, artwork, kind: str = "image") -> str | None:
    """
    Motif d'accès à la pleine résolution ("owner", "free", "visit", "signed") ou None si refusé.
    Pour une requête de fichier (endpoint image/excerpt), la signature ?sig= est aussi acceptée.
    """
    if is_owner_or_staff(request, artwork):
        return "owner"
    status = visit_status(request, artwork.artist)
    if status == "free":
        return "free"
    if status == "granted":
        return "visit"
    if request is not None and signature_valid(request.GET.get(SIGNATURE_PARAM, ""), artwork.slug, kind):
        return "signed"
    return None


def protected_url(request, artwork, kind: str = "image", reason: str | None = None) -> str:
    """
    URL relative de l'endpoint protégé, avec ce qu'il faut pour qu'une balise <img>/<video> ou une
    texture 3D (qui ne peuvent pas envoyer d'en-tête) y accède : le jeton de visite de la requête,
    ou une signature temporaire pour le propriétaire et le staff.
    """
    url = reverse(f"catalog-artwork-{kind}", kwargs={"slug": artwork.slug})
    params = {}
    if reason == "owner":
        params[SIGNATURE_PARAM] = _sign(artwork.slug, kind)
    elif reason == "visit":
        params[VISIT_TOKEN_PARAM] = visit_token_of(request)
    return f"{url}?{urlencode(params)}" if params else url


def file_url(field_file) -> str | None:
    """URL relative (/media/…) d'un fichier, ou None."""
    if not field_file:
        return None
    try:
        return field_file.url
    except ValueError:
        return None
