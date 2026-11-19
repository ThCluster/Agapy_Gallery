"""À lancer chaque minute (cron) quand NOTIFICATIONS_ASYNC=True : envoie les SMS et e-mails en attente."""
from django.core.management.base import BaseCommand

from apps.notifications.services import purge_old, send_pending


class Command(BaseCommand):
    help = "Envoie les notifications en attente (3 essais, délai progressif) et purge les anciennes traces."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=200, help="Nombre maximal de messages par passage.")
        parser.add_argument("--purge-days", type=int, default=30,
                            help="Supprime les messages envoyés ou abandonnés depuis plus de N jours (0 : jamais).")

    def handle(self, *args, limit, purge_days, **options):
        stats = send_pending(limit=limit)
        purged = purge_old(purge_days) if purge_days > 0 else 0
        self.stdout.write(self.style.SUCCESS(
            f"{stats['sent']} envoyé(s), {stats['retry']} à réessayer, {stats['failed']} abandonné(s), "
            f"{purged} ancienne(s) trace(s) supprimée(s)."))
