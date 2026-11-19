"""
Données de démonstration pour le développement : python manage.py seed_demo [--reset] [--force]

Reprend les artistes et œuvres fictifs du frontend (src/mocks/homeData.ts, artistProfiles.ts)
avec les images de frontend/public/images/. Idempotent : relancer la commande ne crée pas de doublons.

Les comptes de démonstration sont reconnus à leur numéro réservé (+22507000090xx) :
--reset supprime ces comptes (et en cascade leurs galeries, œuvres, messages du forum) avant de
les recréer. Les partenaires, pages et catégories du forum ne sont créés que s'ils manquent.
"""
from datetime import date, timedelta
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError
from django.test.utils import override_settings
from django.utils import timezone

from apps.accounts.models import ArtistProfile, ArtistStatus, Civility, User
from apps.catalog.models import Artwork, ArtworkStatus, Discipline, Frame, Gallery
from apps.forum.models import Category, Post, Topic
from apps.site_content.models import Page, Partner
from apps.subscriptions.models import Subscription

DEMO_PHONE_PREFIX = "+22507000090"
DEMO_PASSWORD = "ARTS2026"

# (slug, prénom, nom, civilité, ville, pays ISO, adresse, discipline, portrait, galerie gratuite, gratuite jusqu'au,
#  bureau de protection, bio)
ARTISTS = [
    ("awa-kone", "Awa", "Koné", Civility.MRS, "Abidjan", "CI", 12, "portrait-r2", False, None, "BURIDA (Côte d’Ivoire)",
     "Née à Abidjan, Awa Koné peint la lumière de la lagune Ébrié et l’énergie des marchés du Plateau. Ses toiles, "
     "très colorées, mêlent couteau et pinceau dans une matière généreuse. Formée à l’INSAAC, elle expose depuis dix "
     "ans entre Abidjan, Dakar et Paris."),
    ("moussa-diop", "Moussa", "Diop", Civility.MR, "Dakar", "SN", 18, "portrait-r3", False, None, "SODAV (Sénégal)",
     "Photographe autodidacte, Moussa Diop parcourt les rues de Dakar et de Saint-Louis pour saisir les visages, "
     "les gestes et les rituels du quotidien."),
    ("esther-mbarga", "Esther", "Mbarga", Civility.MRS, "Douala", "CM", 24, "portrait-r4", False, None,
     "SOCAM (Cameroun)",
     "Mosaïste et coloriste, Esther Mbarga transforme céramique, verre et tissus en grands panneaux lumineux "
     "inspirés des marchés de Douala."),
    ("kofi-mensah", "Kofi", "Mensah", Civility.MR, "Accra", "GH", 31, "portrait-r5", False, None, "GHAMRO (Ghana)",
     "Sculpteur du bois et du bronze, Kofi Mensah perpétue les savoir-faire ashanti dans des figures "
     "contemporaines, sobres et puissantes."),
    ("aminata-traore", "Aminata", "Traoré", Civility.MRS, "Bamako", "ML", 37, "portrait-r6", False, None,
     "BUMDA (Mali)",
     "Peintre de la vie des villages du Mali, Aminata Traoré compose de grandes scènes de fête et de travail, "
     "vibrantes de couleurs et de mouvement."),
    ("ibrahim-ouedraogo", "Ibrahim", "Ouédraogo", Civility.MR, "Ouagadougou", "BF", 42, None, True, date(2027, 1, 15),
     "BBDA (Burkina Faso)",
     "Peintre et teinturier, Ibrahim Ouédraogo marie le batik traditionnel du Burkina Faso à une peinture abstraite "
     "et lumineuse. Il ouvre gratuitement sa galerie pour faire découvrir son travail."),
    ("nadia-hounsou", "Nadia", "Hounsou", Civility.MRS, "Cotonou", "BJ", 49, None, True, date(2026, 12, 31),
     "BUBEDRA (Bénin)",
     "Sculptrice béninoise, Nadia Hounsou travaille le bronze et le bois autour des figures de la musique et de la "
     "transmission."),
    ("yao-kouassi", "Yao", "Kouassi", Civility.MR, "Bouaké", "CI", 53, None, True, None, "BURIDA (Côte d’Ivoire)",
     "Photographe de Bouaké, Yao Kouassi saisit les couleurs des marchés et la lumière du Sahel. Sa galerie est "
     "ouverte gratuitement à tous."),
]

T = {
    "acrylique": "Acrylique sur toile",
    "huile": "Huile sur toile",
    "mixte": "Technique mixte",
    "batik": "Batik sur coton",
    "mosaique": "Mosaïque",
    "photo": "Tirage photo, édition limitée",
    "bois": "Sculpture en bois",
    "bronze": "Sculpture en bronze",
}

# (slug, titre, artiste, technique, (hauteur, largeur), image, recommandée, coup de cœur)
ARTWORKS = [
    ("lumiere-lagune", "Lumière de la lagune", "awa-kone", "acrylique", (120, 90), "art-a1", True, False),
    ("regard", "Regard", "moussa-diop", "photo", (90, 60), "art-p2", True, False),
    ("soleil-marche", "Le soleil du marché", "esther-mbarga", "mosaique", (80, 110), "art-a11", True, False),
    ("gardien", "Le gardien assis", "kofi-mensah", "bois", (62, 28), "art-s1", True, False),
    ("danse-village", "La danse du village", "aminata-traore", "huile", (70, 105), "art-a8", True, False),
    ("fils-tisserand", "Fils du tisserand", "ibrahim-ouedraogo", "batik", (100, 100), "art-a10", True, False),
    ("joueur-kora", "Le joueur de kora", "nadia-hounsou", "bronze", (75, 30), "art-s3", True, False),
    ("marche-bouake", "Marché de Bouaké", "yao-kouassi", "photo", (60, 90), "art-p4", True, False),
    ("harmattan", "Harmattan", "awa-kone", "acrylique", (65, 100), "art-a3", False, True),
    ("sous-le-fromager", "Sous le fromager", "aminata-traore", "huile", (80, 100), "art-a12", False, True),
    ("deux-silhouettes", "Deux silhouettes", "esther-mbarga", "mixte", (100, 100), "art-a9", False, True),
    ("porteuses", "Les porteuses", "moussa-diop", "photo", (60, 90), "art-p3", False, True),
    ("carnaval", "Carnaval", "ibrahim-ouedraogo", "acrylique", (120, 90), "art-a13", False, True),
    ("saison-pluies", "Saison des pluies", "awa-kone", "acrylique", (100, 75), "art-a5", False, True),
    ("reine-mere", "Reine mère", "nadia-hounsou", "bois", (55, 30), "art-s2", False, True),
    ("savane", "Mémoire de la savane", "esther-mbarga", "huile", (120, 80), "art-a14", False, True),
    ("lagune-bleue", "Lagune bleue", "ibrahim-ouedraogo", "acrylique", (100, 100), "art-a4", False, False),
    ("aube-rose", "Aube rose", "yao-kouassi", "mixte", (100, 80), "art-a6", False, False),
    ("encre", "Encre et lumière", "ibrahim-ouedraogo", "acrylique", (90, 70), "art-a7", False, False),
    ("crepuscule", "Crépuscule au Sahel", "yao-kouassi", "photo", (60, 90), "art-p5", False, False),
    ("le-sage", "Le sage", "ibrahim-ouedraogo", "huile", (60, 80), "art-a15", False, False),
    ("souffle", "Le souffle", "yao-kouassi", "bois", (70, 25), "art-s4", False, False),
    # Même titre qu'une œuvre d'Awa Koné : homonymes (cahier des charges, p. 10)
    ("harmattan-yao", "Harmattan", "yao-kouassi", "photo", (60, 90), "art-p1", False, False),
]

FRAMES = [Frame.WOOD, Frame.BLACK, Frame.GOLD, Frame.WHITE, Frame.NONE]

PARTNERS = [
    ("BURIDA", "https://www.burida.ci"),
    ("Biennale de Dakar", "https://www.biennaledakar.org"),
    ("Fondation Sahel Arts", ""),
    ("INSAAC", ""),
]

PAGES = {
    "terms": ("Conditions générales d'utilisation", "Terms of use",
              "Texte provisoire des conditions générales d'utilisation d'AGAPY-GALLERY. "
              "À remplacer par la version validée depuis l'administration."),
    "about": ("Qui sommes-nous ?", "About us",
              "AGAPY-GALLERY est une galerie d'art virtuelle qui permet aux artistes africains d'exposer leurs "
              "œuvres dans une ville 3D et de les faire découvrir au monde entier."),
    "legal": ("Informations légales", "Legal notice",
              "Texte provisoire des informations légales (éditeur, hébergeur, contact). "
              "À compléter depuis l'administration."),
}

# Mêmes identifiants que frontend/src/pages/static/ForumPage.tsx
FORUM = [
    ("mutual", "Entraide", "Questions et conseils entre artistes.", "awa-kone",
     "Bienvenue sur le forum : présentez-vous ici",
     "Bonjour à toutes et à tous ! Présentez-vous en quelques mots : votre discipline, votre ville, vos projets.",
     True, "moussa-diop", "Bonjour, je suis photographe à Dakar. Ravi de vous rejoindre !"),
    ("techniques", "Techniques", "Matériaux, prise de vue, numérisation des œuvres.", "esther-mbarga",
     "Comment bien photographier ses toiles pour la galerie ?",
     "Lumière du jour, sans reflet, appareil bien parallèle à la toile : partagez vos astuces.",
     False, "yao-kouassi", "Je photographie toujours à l'ombre, en fin de matinée : les couleurs restent fidèles."),
    ("copyright", "Droits d'auteur", "Bureaux de protection, contrats, droits de reproduction.", "kofi-mensah",
     "Déclarer ses œuvres au bureau des droits d'auteur : mode d'emploi",
     "Quelles pièces faut-il fournir au BURIDA, à la SODAV ou au GHAMRO ? Mettons en commun nos expériences.",
     False, "awa-kone", "Au BURIDA, il faut une photo de chaque œuvre et une pièce d'identité."),
    ("events", "Événements", "Expositions, biennales, résidences et appels à candidatures.", "aminata-traore",
     "Biennale de Dakar : qui expose cette année ?",
     "Je cherche des artistes qui exposent à la prochaine Biennale pour organiser une visite commune.",
     False, None, ""),
    ("city", "La ville 3D", "Idées et retours sur la ville virtuelle AGAPY.", "nadia-hounsou",
     "Accrochage dans la villa : combien d'œuvres par salle ?",
     "Trois ou quatre œuvres par salle me semblent idéales. Et vous ?",
     False, None, ""),
]


def demo_phone(index: int) -> str:
    return f"{DEMO_PHONE_PREFIX}{index:02d}"


class Command(BaseCommand):
    help = "Crée les données de démonstration (artistes, galeries, œuvres, pages, forum). Développement uniquement."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Supprime d'abord les comptes de démonstration et leurs contenus.")
        parser.add_argument("--force", action="store_true", help="Autorise l'exécution avec DEBUG=False.")
        parser.add_argument("--media-root", help="Dossier où copier les images (par défaut MEDIA_ROOT).")
        parser.add_argument("--images-dir", help="Dossier des images (par défaut ../frontend/public/images).")

    def handle(self, *args, **opts):
        if not settings.DEBUG and not opts["force"]:
            raise CommandError("DEBUG est désactivé : ajoutez --force pour créer des données de démonstration.")
        self.images_dir = Path(opts["images_dir"] or Path(settings.BASE_DIR).parent / "frontend" / "public" / "images")
        if not self.images_dir.is_dir():
            raise CommandError(f"Dossier d'images introuvable : {self.images_dir}")

        media_root = opts["media_root"] or settings.MEDIA_ROOT
        with override_settings(MEDIA_ROOT=str(media_root)):
            if opts["reset"]:
                self.reset()
            with transaction.atomic():
                artists = self.seed_artists()
                created_works = self.seed_artworks(artists)
                self.seed_site()
                self.seed_forum(artists)

        self.stdout.write(self.style.SUCCESS(
            f"Données de démonstration prêtes : {len(artists)} artistes, {created_works} œuvre(s) créée(s)."))
        self.stdout.write(f"Mot de passe de tous les comptes : {DEMO_PASSWORD}")
        for i, (slug, *_rest) in enumerate(ARTISTS, start=1):
            self.stdout.write(f"  {demo_phone(i)}  {artists[slug].display_name}")

    # ------------------------------------------------------------------
    def reset(self):
        users = User.objects.filter(phone__startswith=DEMO_PHONE_PREFIX)
        files = [a.image for a in Artwork.objects.filter(artist__user__in=users) if a.image]
        files += [p.photo for p in ArtistProfile.objects.filter(user__in=users) if p.photo]
        try:
            with transaction.atomic():
                count = users.count()
                users.delete()
        except ProtectedError as exc:
            raise CommandError(
                "Impossible de supprimer les comptes de démonstration : des paiements ou retraits y sont liés "
                f"({len(exc.protected_objects)} objet(s)). Videz la base de développement ou supprimez-les "
                "depuis l'administration.") from exc
        for f in files:
            f.storage.delete(f.name)
        self.stdout.write(f"{count} compte(s) de démonstration supprimé(s).")

    def _image(self, name: str) -> File:
        path = self.images_dir / f"{name}.webp"
        if not path.is_file():
            raise CommandError(f"Image introuvable : {path}")
        return File(path.open("rb"), name=path.name)

    def seed_artists(self) -> dict[str, ArtistProfile]:
        now = timezone.now()
        result = {}
        for i, (slug, first, last, civ, city, country, address, portrait, free, free_until, office, bio) in \
                enumerate(ARTISTS, start=1):
            phone = demo_phone(i)
            user = User.objects.filter(phone=phone).first()
            if user is None:
                user = User.objects.create_user(phone=phone, password=DEMO_PASSWORD, email=f"{slug}@demo.agapy.local")
            profile = ArtistProfile.objects.filter(user=user).first()
            if profile is None:
                profile = ArtistProfile(
                    user=user, civility=civ, first_names=first, last_name=last, artist_name=f"{first} {last}",
                    country=country, city=city, bio=bio, status=ArtistStatus.ACTIVE,
                    payout_momo=True, momo_operator="Orange Money", momo_number=phone,
                    accepted_terms_at=now, activated_at=now,
                )
                if not ArtistProfile.objects.filter(slug=slug).exists():
                    profile.slug = slug
                if portrait:
                    with self._image(portrait) as f:
                        profile.photo.save(f.name, f, save=False)
                profile.save()
            result[slug] = profile

            if not Gallery.objects.filter(artist=profile).exists():
                gallery = Gallery(artist=profile, is_free=free, free_until=free_until, free_publication_used=True)
                if not Gallery.objects.filter(address_number=address).exists():
                    gallery.address_number = address
                gallery.save()
            Subscription.objects.get_or_create(
                artist=profile, defaults={"started_at": now, "expires_at": now + timedelta(days=365)})
        return result

    def seed_artworks(self, artists) -> int:
        now = timezone.now()
        created = 0
        for n, (slug, title, artist_slug, tech, (h, w), image, recommended, favorite) in enumerate(ARTWORKS):
            artist = artists[artist_slug]
            if Artwork.objects.filter(artist=artist, title=title).exists():
                continue
            key = tech
            discipline = (Discipline.PHOTOGRAPHY if key == "photo"
                          else Discipline.SCULPTURE if key in ("bois", "bronze") else Discipline.PAINTING)
            artwork = Artwork(
                artist=artist, title=title, technique=T[key], discipline=discipline, height_cm=h, width_cm=w,
                summary=f"« {title} » est une œuvre de {artist.display_name}, réalisée à {artist.city}. "
                        f"{T[key]}, {h} × {w} cm.",
                frame=FRAMES[n % len(FRAMES)] if discipline != Discipline.SCULPTURE else Frame.NONE,
                author_name=artist.display_name, copyright_office=ARTISTS_BY_SLUG[artist_slug][10],
                owner_certified=True, is_free=artist.gallery.is_free, recommended=recommended, team_favorite=favorite,
                status=ArtworkStatus.PUBLISHED, publication_settled=True,
                submitted_at=now - timedelta(days=n + 2), moderated_at=now - timedelta(days=n + 1),
                published_at=now - timedelta(days=n + 1),
            )
            if not Artwork.objects.filter(slug=slug).exists():
                artwork.slug = slug
            with self._image(image) as f:
                artwork.image.save(f.name, f, save=False)
            artwork.save()
            created += 1
        return created

    def seed_site(self):
        if not Partner.objects.exists():
            for order, (name, url) in enumerate(PARTNERS):
                Partner.objects.create(name=name, url=url, order=order)
        for slug, (title_fr, title_en, body) in PAGES.items():
            Page.objects.get_or_create(slug=slug, defaults={"title_fr": title_fr, "title_en": title_en,
                                                            "body_fr": body})

    def seed_forum(self, artists):
        now = timezone.now()
        for order, (slug, name, desc, author, title, body, pinned, replier, reply) in enumerate(FORUM):
            category, _ = Category.objects.get_or_create(
                slug=slug, defaults={"name": name, "description": desc, "order": order})
            if category.topics.exists():
                continue
            started = now - timedelta(days=order + 1)
            topic = Topic.objects.create(category=category, author=artists[author], title=title, body=body,
                                         is_pinned=pinned, created_at=started, last_post_at=started)
            if replier:
                replied = started + timedelta(hours=3)
                Post.objects.create(topic=topic, author=artists[replier], body=reply, created_at=replied)
                Topic.objects.filter(pk=topic.pk).update(last_post_at=replied)


ARTISTS_BY_SLUG = {a[0]: a for a in ARTISTS}
