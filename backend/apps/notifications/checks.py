"""Vérifications système (manage.py check --deploy, runserver) : notifications non branchées en production."""
from django.conf import settings
from django.core import checks

CONSOLE_SMS = "apps.notifications.sms.ConsoleSmsBackend"
CONSOLE_EMAIL = "django.core.mail.backends.console.EmailBackend"


@checks.register(checks.Tags.compatibility)
def notification_backends_check(app_configs=None, **kwargs):
    if settings.DEBUG:
        return []
    warnings = []
    if settings.SMS_BACKEND == CONSOLE_SMS:
        warnings.append(checks.Warning(
            "Aucun fournisseur SMS n'est configuré : les SMS (identifiants, codes) ne partent pas.",
            hint="Déclarez un fournisseur réel dans SMS_BACKEND.",
            id="agapy.W001",
        ))
    if settings.EMAIL_BACKEND == CONSOLE_EMAIL:
        warnings.append(checks.Warning(
            "Les e-mails sont seulement affichés dans la console du serveur.",
            hint="Renseignez EMAIL_URL (serveur SMTP).",
            id="agapy.W002",
        ))
    if getattr(settings, "NOTIFICATIONS_ASYNC", False) and not getattr(settings, "FIELD_ENCRYPTION_KEY", None):
        warnings.append(checks.Warning(
            "NOTIFICATIONS_ASYNC est actif sans FIELD_ENCRYPTION_KEY : les messages ne peuvent pas être "
            "chiffrés et partent pendant la requête.",
            hint="Renseignez FIELD_ENCRYPTION_KEY (clé Fernet).",
            id="agapy.W003",
        ))
    return warnings
