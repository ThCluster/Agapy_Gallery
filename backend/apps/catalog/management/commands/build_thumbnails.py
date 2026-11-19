"""Génère les miniatures publiques des œuvres qui n'en ont pas (idempotent)."""
from django.core.management.base import BaseCommand

from apps.catalog.models import Artwork


class Command(BaseCommand):
    help = "Génère les miniatures publiques (WebP) des œuvres qui n'en ont pas. --force : les régénère toutes."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Régénère aussi les miniatures existantes.")

    def handle(self, *args, force=False, **opts):
        qs = Artwork.objects.exclude(image="").select_related("artist").order_by("pk")
        built = skipped = failed = 0
        for artwork in qs.iterator(chunk_size=200):
            if artwork.thumbnail and not force and artwork.thumbnail.storage.exists(artwork.thumbnail.name):
                skipped += 1
                continue
            if artwork.build_thumbnail():
                built += 1
            else:
                failed += 1
                self.stderr.write(f"Échec : {artwork.slug} ({artwork.image.name})")
        self.stdout.write(self.style.SUCCESS(
            f"{built} miniature(s) générée(s), {skipped} déjà présente(s), {failed} échec(s)."))
