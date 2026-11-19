from django.core.management.base import BaseCommand

from apps.promotions import services


class Command(BaseCommand):
    help = "Termine les clips diffusés depuis 24 h et met en diffusion les suivants de la file (à lancer chaque minute)."

    def handle(self, *args, **options):
        started = services.refresh_queue()
        self.stdout.write(f"{started} clip(s) mis en diffusion.")
