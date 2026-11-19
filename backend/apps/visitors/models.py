"""
Comptes visiteurs (clients) : inscription gratuite, connexion avec le numéro de téléphone.

Un visiteur peut payer sans compte ; inscrit, il dispose d'un Compte d'Avoir (cahier des charges p. 10 :
« Les Artistes tout comme les clients peuvent disposer de Compte d'Avoir ») et retrouve ses droits de
visite et ses paiements. Un User est soit artiste (User.artist), soit visiteur (User.visitor), jamais les deux.
"""
from django.conf import settings
from django.db import models

from apps.core.regions import region_of


class VisitorProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="visitor",
                                verbose_name="compte")
    display_name = models.CharField("nom affiché", max_length=150)
    # Fixe la zone tarifaire et la devise du Compte d'Avoir : non modifiable par le visiteur
    country = models.CharField("pays", max_length=2)
    created_at = models.DateTimeField("inscrit le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        verbose_name = "visiteur"
        verbose_name_plural = "visiteurs"
        ordering = ["-created_at"]

    def __str__(self):
        return self.display_name

    @property
    def region(self) -> str:
        return region_of(self.country)


class SignupCode(models.Model):
    """
    Code à 6 chiffres envoyé par SMS pour prouver la possession du numéro avant l'inscription.
    Aucun compte n'existe encore : le code est rattaché au numéro. Seule son empreinte HMAC est stockée.
    """

    phone = models.CharField("téléphone", max_length=20, db_index=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "code d'inscription"
        verbose_name_plural = "codes d'inscription"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["phone", "-created_at"])]
