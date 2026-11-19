"""Contact, newsletter, compteur d'artistes et messages aux artistes."""
from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import ArtistProfile, ArtistStatus
from apps.core.pricing import ARTIST_COUNTER_FLOOR
from apps.notifications.services import send_email, send_sms

from .models import Broadcast, BroadcastAudience, BroadcastChannel, ContactMessage, NewsletterSubscriber

UNSUBSCRIBE_SALT = "agapy.newsletter.unsubscribe"


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------
def contact_email() -> str:
    return getattr(settings, "AGAPY_CONTACT_EMAIL", settings.DEFAULT_FROM_EMAIL)


def submit_contact(*, ip_address=None, **data) -> ContactMessage:
    msg = ContactMessage.objects.create(ip_address=ip_address, **data)
    body = (f"Nom : {msg.name}\nE-mail : {msg.email}\nTéléphone : {msg.phone or '—'}\n\n{msg.message}")
    send_email(contact_email(), f"[Contact AGAPY] {msg.subject}", body)
    return msg


# ---------------------------------------------------------------------------
# Newsletter
# ---------------------------------------------------------------------------
def unsubscribe_token(email: str) -> str:
    return signing.dumps(email.lower(), salt=UNSUBSCRIBE_SALT)


def subscribe(email: str, language: str = "fr") -> tuple[NewsletterSubscriber, bool]:
    """
    Inscrit (ou réinscrit) une adresse. Idempotent : une adresse déjà abonnée ne reçoit pas
    de nouvel e-mail. → (abonné, inscription nouvelle ou reprise ?)
    """
    email = email.strip().lower()
    sub, created = NewsletterSubscriber.objects.get_or_create(email=email, defaults={"language": language})
    if not created:
        created = not sub.is_active  # réinscription après désinscription
        if created or sub.language != language:
            sub.is_active, sub.language, sub.unsubscribed_at = True, language, None
            sub.save(update_fields=["is_active", "language", "unsubscribed_at"])
    if created:
        link = f"{settings.FRONTEND_URL}/newsletter/desinscription?token={unsubscribe_token(email)}"
        if language == "en":
            send_email(email, "AGAPY-GALLERY newsletter",
                       f"Thank you for subscribing to the AGAPY-GALLERY newsletter.\n\nUnsubscribe: {link}")
        else:
            send_email(email, "Newsletter AGAPY-GALLERY",
                       f"Merci de votre inscription à la newsletter d'AGAPY-GALLERY.\n\nSe désinscrire : {link}")
    return sub, created


def unsubscribe(token: str) -> bool:
    """Désinscrit l'adresse du jeton signé. False si le jeton est invalide."""
    try:
        email = signing.loads(token, salt=UNSUBSCRIBE_SALT)
    except signing.BadSignature:
        return False
    NewsletterSubscriber.objects.filter(email=email, is_active=True).update(
        is_active=False, unsubscribed_at=timezone.now())
    return True


# ---------------------------------------------------------------------------
# Compteur
# ---------------------------------------------------------------------------
def artist_count() -> int:
    """Nombre d'artistes affiché : au moins 1 500, il n'augmente qu'à partir de la 1 501e inscription."""
    real = ArtistProfile.objects.filter(status__in=[ArtistStatus.ACTIVE, ArtistStatus.DORMANT]).count()
    return max(ARTIST_COUNTER_FLOOR, real)


# ---------------------------------------------------------------------------
# Messages aux artistes
# ---------------------------------------------------------------------------
AUDIENCE_STATUSES = {
    BroadcastAudience.ALL: [ArtistStatus.ACTIVE, ArtistStatus.DORMANT],
    BroadcastAudience.ACTIVE: [ArtistStatus.ACTIVE],
    BroadcastAudience.DORMANT: [ArtistStatus.DORMANT],
}


def send_broadcast(broadcast: Broadcast) -> bool:
    """
    Envoie le message aux artistes visés. Un message déjà envoyé n'est jamais renvoyé
    (le verrou et sent_at le garantissent même si deux administrateurs cliquent en même temps).
    Renvoie False si le message était déjà envoyé.
    """
    with transaction.atomic():
        b = Broadcast.objects.select_for_update().get(pk=broadcast.pk)
        if b.sent_at is not None:
            return False
        b.sent_at = timezone.now()
        b.save(update_fields=["sent_at"])

    artists = (ArtistProfile.objects.filter(status__in=AUDIENCE_STATUSES[b.audience])
               .select_related("user").order_by("pk"))
    sms = b.channel in (BroadcastChannel.SMS, BroadcastChannel.BOTH)
    email = b.channel in (BroadcastChannel.EMAIL, BroadcastChannel.BOTH)
    reached = failures = 0
    for artist in artists.iterator():
        ok = False
        if sms and artist.user.phone:
            sent = send_sms(artist.user.phone, f"AGAPY-GALLERY : {b.message}")
            ok, failures = ok or sent, failures + (not sent)
        if email and artist.user.email:
            sent = send_email(artist.user.email, b.title, b.message)
            ok, failures = ok or sent, failures + (not sent)
        reached += ok
    Broadcast.objects.filter(pk=b.pk).update(recipient_count=reached, failure_count=failures)
    return True
