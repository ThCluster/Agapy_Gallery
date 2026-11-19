"""À lancer chaque jour (cron) : mise en veille à la date anniversaire et rappels à J-30 et J-7."""
from django.core.management.base import BaseCommand

from apps.subscriptions.services import expire_and_remind


class Command(BaseCommand):
    help = "Met en veille les abonnements échus et envoie les rappels de renouvellement (J-30, J-7)."

    def handle(self, *args, **options):
        stats = expire_and_remind()
        self.stdout.write(self.style.SUCCESS(
            f"{stats['expired']} compte(s) mis en veille, {stats['reminded']} rappel(s) envoyé(s), "
            f"{stats['backfilled']} abonnement(s) repris."))
