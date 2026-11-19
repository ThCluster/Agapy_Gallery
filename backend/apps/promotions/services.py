"""Clips de l'accueil (commande, file d'attente), espaces publicitaires et TV en ligne."""
import random
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.pricing import CLIP_DURATION_HOURS, CLIP_SLOTS, clip_quote
from apps.payments import services as payments

from .models import AdCampaign, AdFormat, Clip, ClipStatus, LiveStream

BUTTONS_PER_PAGE = 3


# ---------------------------------------------------------------------------
# Clips
# ---------------------------------------------------------------------------
@transaction.atomic
def order_clip(*, data: dict, method: str, user=None):
    """Enregistre le clip et lance son paiement (3 000 F HT / 3 300 F TTC pour 24 h). → (clip, payment, action)"""
    authenticated = user is not None and user.is_authenticated
    artist = getattr(user, "artist", None) if authenticated else None
    clip = Clip.objects.create(artist=artist, **data)
    payment = payments.create_payment(
        purpose="clip", method=method, quote=clip_quote(), region="africa", artist=artist,
        payer_user=user if authenticated else None, target=clip,
        payer_name=clip.advertiser, payer_email=clip.contact_email, payer_phone=clip.contact_phone,
    )
    action = payments.start_payment(payment)
    return clip, payment, action


def mark_clip_paid(clip: Clip, paid_at=None) -> None:
    """Paiement confirmé : le clip entre dans la file d'attente (appelé dans la transaction du paiement)."""
    clip = Clip.objects.select_for_update().get(pk=clip.pk)
    if clip.status != ClipStatus.AWAITING_PAYMENT:
        return
    clip.status = ClipStatus.QUEUED
    clip.paid_at = paid_at or timezone.now()
    clip.save(update_fields=["status", "paid_at"])
    refresh_queue()


@transaction.atomic
def refresh_queue(now=None) -> int:
    """
    Termine les clips dont les 24 h sont écoulées et fait entrer les suivants, dans l'ordre
    de paiement, dans la limite de CLIP_SLOTS clips diffusés en même temps.
    Idempotente. Renvoie le nombre de clips mis en diffusion.
    """
    now = now or timezone.now()
    playing = list(Clip.objects.select_for_update().filter(status=ClipStatus.PLAYING).values_list("pk", "ends_at"))
    expired = [pk for pk, ends_at in playing if ends_at is None or ends_at <= now]
    if expired:
        Clip.objects.filter(pk__in=expired).update(status=ClipStatus.FINISHED)
    free = CLIP_SLOTS - (len(playing) - len(expired))
    if free <= 0:
        return 0
    queued = list(Clip.objects.select_for_update().filter(status=ClipStatus.QUEUED)
                  .order_by("paid_at", "pk").values_list("pk", flat=True)[:free])
    if queued:
        Clip.objects.filter(pk__in=queued).update(
            status=ClipStatus.PLAYING, starts_at=now, ends_at=now + timedelta(hours=CLIP_DURATION_HOURS))
    return len(queued)


def live_clips():
    """Clips en diffusion, après mise à jour de la file (le frontend les enchaîne en boucle)."""
    refresh_queue()
    return Clip.objects.filter(status=ClipStatus.PLAYING).order_by("starts_at", "paid_at", "pk")


@transaction.atomic
def reject_clip(clip: Clip, reason: str = "") -> None:
    """Retire un clip inapproprié ; s'il était diffusé, sa place revient au suivant de la file."""
    clip = Clip.objects.select_for_update().get(pk=clip.pk)
    if clip.status == ClipStatus.REJECTED:
        return
    was_playing = clip.status == ClipStatus.PLAYING
    clip.status = ClipStatus.REJECTED
    clip.rejection_reason = reason[:255]
    clip.save(update_fields=["status", "rejection_reason"])
    if was_playing:
        refresh_queue()


def queue_position(clip: Clip) -> int | None:
    """Rang dans la file d'attente (1 = prochain à passer), None si le clip n'y est pas."""
    if clip.status != ClipStatus.QUEUED or clip.paid_at is None:
        return None
    ahead = Clip.objects.filter(status=ClipStatus.QUEUED).filter(
        Q(paid_at__lt=clip.paid_at) | Q(paid_at=clip.paid_at, pk__lt=clip.pk)).count()
    return ahead + 1


# ---------------------------------------------------------------------------
# Espaces publicitaires et TV
# ---------------------------------------------------------------------------
def active_campaigns(fmt: str, now=None):
    now = now or timezone.now()
    return AdCampaign.objects.filter(format=fmt, is_active=True, starts_at__lte=now).filter(
        Q(ends_at__isnull=True) | Q(ends_at__gt=now))


def pick_ads(fmt: str) -> list[AdCampaign]:
    """Tirage pondéré, sans remise, des campagnes à afficher : 3 pour les boutons, 1 pour les autres formats."""
    limit = BUTTONS_PER_PAGE if fmt == AdFormat.BUTTON else 1
    pool = list(active_campaigns(fmt))
    chosen = []
    while pool and len(chosen) < limit:
        pick = random.choices(pool, weights=[max(c.weight, 1) for c in pool])[0]
        chosen.append(pick)
        pool.remove(pick)
    return chosen


def live_tv(now=None, upcoming_limit=10) -> dict:
    """Direct en cours (le plus récent marqué « en direct ») et prochaines émissions."""
    now = now or timezone.now()
    live = (LiveStream.objects.filter(is_live=True).filter(Q(ends_at__isnull=True) | Q(ends_at__gt=now))
            .order_by("-starts_at").first())
    upcoming = LiveStream.objects.filter(is_live=False, starts_at__gt=now).order_by("starts_at")[:upcoming_limit]
    return {"live": live, "upcoming": list(upcoming)}
