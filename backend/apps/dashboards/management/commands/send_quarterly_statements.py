"""
Bilan financier trimestriel des artistes (cahier des charges : un message tous les 3 mois).

À planifier tous les 3 mois (ex. cron « 0 9 1 1,4,7,10 * »). Chaque artiste actif ou en veille
reçoit au plus un bilan par trimestre (StatementLog unique par artiste et trimestre) : relancer
la commande ne renvoie rien aux artistes déjà prévenus.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import ArtistProfile, ArtistStatus
from apps.notifications.services import send_email, send_sms

from ...models import StatementLog
from ...services import quarter_label, statement_message

SUBJECT = "AGAPY-GALLERY : votre point financier du trimestre"


class Command(BaseCommand):
    help = "Envoie à chaque artiste actif ou en veille son bilan trimestriel par SMS et par e-mail."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Affiche les messages sans rien envoyer.")
        parser.add_argument("--quarter", help="Trimestre à utiliser (ex. 2026-Q4). Par défaut : le trimestre en cours.")

    def handle(self, *args, dry_run=False, quarter=None, **options):
        quarter = quarter or quarter_label(timezone.localdate())
        if len(quarter) != 7 or quarter[4:6] != "-Q" or quarter[6] not in "1234" or not quarter[:4].isdigit():
            raise CommandError("Trimestre invalide (format attendu : 2026-Q4).")
        done = set(StatementLog.objects.filter(quarter=quarter).values_list("artist_id", flat=True))
        artists = (ArtistProfile.objects.filter(status__in=[ArtistStatus.ACTIVE, ArtistStatus.DORMANT])
                   .exclude(pk__in=done).select_related("user").order_by("pk"))
        sent = 0
        for artist in artists.iterator():
            message = statement_message(artist)
            if dry_run:
                self.stdout.write(f"[{quarter}] {artist} ({artist.user.phone}) : {message}")
                sent += 1
                continue
            try:
                with transaction.atomic():
                    log = StatementLog.objects.create(artist=artist, quarter=quarter, message=message)
            except IntegrityError:  # déjà envoyé par une exécution concurrente
                continue
            log.sms_sent = send_sms(artist.user.phone, message)
            log.email_sent = send_email(artist.user.email, SUBJECT, message)
            log.save(update_fields=["sms_sent", "email_sent"])
            sent += 1
        verb = "à envoyer" if dry_run else "envoyés"
        self.stdout.write(self.style.SUCCESS(f"{sent} bilan(s) {verb} pour {quarter}."))
