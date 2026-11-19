"""
Forum de discussion des artistes (cahier des charges : entraide, techniques, droits d'auteur…).

- Lecture publique ; seuls les artistes connectés (ni exclus ni en attente d'ouverture) écrivent.
- Un sujet est un titre + un premier message ; les réponses sont des messages du sujet.
- L'équipe AGAPY épingle / verrouille les sujets, masque les messages et traite les signalements.
"""
from django.db import models
from django.utils import timezone

TITLE_MIN, TITLE_MAX = 5, 150
BODY_MIN, BODY_MAX = 2, 5000


class Category(models.Model):
    slug = models.SlugField("identifiant", max_length=40, unique=True,
                            help_text="Identifiant utilisé par le site, ex. mutual, techniques, copyright.")
    name = models.CharField("nom", max_length=100)
    description = models.CharField("description", max_length=255, blank=True)
    order = models.PositiveSmallIntegerField("ordre", default=0)
    is_active = models.BooleanField("active", default=True)

    class Meta:
        verbose_name = "catégorie"
        verbose_name_plural = "catégories"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Topic(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="topics", verbose_name="catégorie")
    author = models.ForeignKey("accounts.ArtistProfile", on_delete=models.CASCADE, related_name="forum_topics",
                               verbose_name="auteur")
    title = models.CharField("titre", max_length=TITLE_MAX)
    body = models.TextField("premier message", max_length=BODY_MAX)
    is_pinned = models.BooleanField("épinglé", default=False, db_index=True)
    is_locked = models.BooleanField("verrouillé", default=False,
                                    help_text="Un sujet verrouillé n'accepte plus de réponse.")
    is_hidden = models.BooleanField("masqué", default=False, db_index=True)
    created_at = models.DateTimeField("créé le", default=timezone.now)
    last_post_at = models.DateTimeField("dernier message le", default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "sujet"
        verbose_name_plural = "sujets"
        ordering = ["-is_pinned", "-last_post_at"]

    def __str__(self):
        return self.title


class Post(models.Model):
    """Réponse à un sujet (le premier message est Topic.body)."""

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="posts", verbose_name="sujet")
    author = models.ForeignKey("accounts.ArtistProfile", on_delete=models.CASCADE, related_name="forum_posts",
                               verbose_name="auteur")
    body = models.TextField("message", max_length=BODY_MAX)
    is_hidden = models.BooleanField("masqué", default=False, db_index=True)
    created_at = models.DateTimeField("publié le", default=timezone.now)

    class Meta:
        verbose_name = "message"
        verbose_name_plural = "messages"
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["topic", "created_at"])]

    def __str__(self):
        return f"{self.author} — {self.body[:50]}"


class Report(models.Model):
    """Signalement d'un message par un visiteur ou un artiste."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reports", verbose_name="message")
    reason = models.CharField("motif", max_length=500)
    ip_address = models.GenericIPAddressField("adresse IP", null=True, blank=True)
    is_handled = models.BooleanField("traité", default=False, db_index=True)
    handled_at = models.DateTimeField("traité le", null=True, blank=True)
    created_at = models.DateTimeField("reçu le", auto_now_add=True)

    class Meta:
        verbose_name = "signalement"
        verbose_name_plural = "signalements"
        ordering = ["is_handled", "-created_at"]

    def __str__(self):
        return f"Signalement #{self.pk} — message #{self.post_id}"
