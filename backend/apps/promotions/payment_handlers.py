from apps.payments.registry import on_paid

from . import services
from .models import Clip


@on_paid("clip")
def clip_paid(payment):
    """Clip payé : en file d'attente, puis diffusé dès qu'une place se libère."""
    clip = Clip.objects.filter(pk=payment.target_id).first() if payment.target_id else None
    if clip is not None:
        services.mark_clip_paid(clip, paid_at=payment.paid_at)
