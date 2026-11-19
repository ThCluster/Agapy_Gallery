"""
Contenu du site : messages de contact, newsletter, partenaires, pages éditables
et messages envoyés par l'équipe aux artistes.
"""
from django.db import models


class ContactMessage(models.Model):
    name = models.CharField("nom", max_length=150)
    email = models.EmailField("e-mail")
    phone = models.CharField("téléphone", max_length=30, blank=True)
    subject = models.CharField("sujet", max_length=200)
    message = models.TextField("message")
    ip_address = models.GenericIPAddressField("adresse IP", null=True, blank=True)
    is_handled = models.BooleanField("traité", default=False, db_index=True)
    handled_at = models.DateTimeField("traité le", null=True, blank=True)
    created_at = models.DateTimeField("reçu le", auto_now_add=True)

    class Meta:
        verbose_name = "message de contact"
        verbose_name_plural = "messages de contact"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.subject} — {self.name}"


class Language(models.TextChoices):
    FR = "fr", "Français"
    EN = "en", "English"


class NewsletterSubscriber(models.Model):
    email = models.EmailField("e-mail", unique=True)
    language = models.CharField("langue", max_length=2, choices=Language, default=Language.FR)
    is_active = models.BooleanField("abonné", default=True, db_index=True)
    subscribed_at = models.DateTimeField("inscrit le", auto_now_add=True)
    unsubscribed_at = models.DateTimeField("désinscrit le", null=True, blank=True)

    class Meta:
        verbose_name = "abonné à la newsletter"
        verbose_name_plural = "abonnés à la newsletter"
        ordering = ["-subscribed_at"]

    def __str__(self):
        return self.email


class Partner(models.Model):
    name = models.CharField("nom", max_length=150)
    logo = models.ImageField("logo", upload_to="partners/", blank=True)
    url = models.URLField("lien", blank=True)
    order = models.PositiveSmallIntegerField("ordre", default=0)
    is_active = models.BooleanField("actif", default=True)

    class Meta:
        verbose_name = "partenaire"
        verbose_name_plural = "partenaires"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Page(models.Model):
    """Page éditable du site (conditions générales, qui sommes-nous, infos légales…)."""

    slug = models.SlugField("identifiant", max_length=60, unique=True,
                            help_text="Ex. terms, about, legal, advertising.")
    title_fr = models.CharField("titre (français)", max_length=200)
    title_en = models.CharField("titre (anglais)", max_length=200, blank=True)
    body_fr = models.TextField("contenu (français)", help_text="Texte ou Markdown.")
    body_en = models.TextField("contenu (anglais)", blank=True, help_text="Vide : la version française est affichée.")
    is_published = models.BooleanField("publiée", default=True)
    updated_at = models.DateTimeField("modifiée le", auto_now=True)

    class Meta:
        verbose_name = "page"
        verbose_name_plural = "pages"
        ordering = ["slug"]

    def __str__(self):
        return self.title_fr

    def localized(self, lang: str) -> dict:
        en = lang == "en"
        return {
            "slug": self.slug,
            "lang": "en" if en and self.body_en else "fr",
            "title": (self.title_en if en and self.title_en else self.title_fr),
            "body": (self.body_en if en and self.body_en else self.body_fr),
            "updated_at": self.updated_at,
        }


class BroadcastChannel(models.TextChoices):
    SMS = "sms", "SMS"
    EMAIL = "email", "E-mail"
    BOTH = "both", "SMS et e-mail"


class BroadcastAudience(models.TextChoices):
    ALL = "all", "Tous les artistes (actifs et en veille)"
    ACTIVE = "active", "Artistes actifs"
    DORMANT = "dormant", "Artistes en veille"


class Broadcast(models.Model):
    """Message de l'équipe aux artistes souscripteurs, envoyé par SMS et/ou e-mail depuis l'administration."""

    title = models.CharField("titre", max_length=200, help_text="Sert d'objet à l'e-mail.")
    message = models.TextField("message")
    channel = models.CharField("canal", max_length=5, choices=BroadcastChannel, default=BroadcastChannel.BOTH)
    audience = models.CharField("destinataires", max_length=10, choices=BroadcastAudience,
                                default=BroadcastAudience.ALL)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    sent_at = models.DateTimeField("envoyé le", null=True, blank=True)
    recipient_count = models.PositiveIntegerField("nombre de destinataires", default=0)
    failure_count = models.PositiveIntegerField("envois échoués", default=0)

    class Meta:
        verbose_name = "message aux artistes"
        verbose_name_plural = "messages aux artistes"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
