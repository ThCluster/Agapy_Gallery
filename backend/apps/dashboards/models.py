from django.db import models


class StatementLog(models.Model):
    """Bilan trimestriel envoyé à un artiste (un seul par trimestre, voir send_quarterly_statements)."""

    artist = models.ForeignKey("accounts.ArtistProfile", on_delete=models.CASCADE, related_name="statement_logs",
                               verbose_name="artiste")
    quarter = models.CharField("trimestre", max_length=7, help_text="Ex. 2026-Q4")
    message = models.TextField("message")
    sms_sent = models.BooleanField("SMS envoyé", default=False)
    email_sent = models.BooleanField("e-mail envoyé", default=False)
    created_at = models.DateTimeField("envoyé le", auto_now_add=True)

    class Meta:
        verbose_name = "bilan trimestriel"
        verbose_name_plural = "bilans trimestriels"
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["artist", "quarter"], name="unique_statement_per_quarter")]

    def __str__(self):
        return f"{self.artist} — {self.quarter}"
