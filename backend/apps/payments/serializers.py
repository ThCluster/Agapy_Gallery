from rest_framework import serializers

from apps.core.pricing import CURRENCY_OF_REGION, TARIFFS
from apps.core.regions import Region

from .models import Method, Payment, PaymentStatus, PayoutChannel, PayoutRequest, Purpose

QUOTE_KINDS = [*TARIFFS.keys(), "clip"]


class QuoteQuerySerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=QUOTE_KINDS)
    region = serializers.ChoiceField(choices=Region.choices, default=Region.AFRICA)


class PaymentStatusSerializer(serializers.ModelSerializer):
    """Statut public d'un paiement : aucune donnée personnelle du payeur."""

    artist = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    visit = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ["reference", "purpose", "method", "status", "currency", "amount_ht", "vat", "amount_ttc",
                  "artist", "created_at", "paid_at", "visit"]
        read_only_fields = fields

    def get_visit(self, obj) -> dict | None:
        """Pour une visite payée : le jeton à envoyer en en-tête X-Visit-Token."""
        if obj.purpose != Purpose.VISIT or obj.status != PaymentStatus.SUCCEEDED:
            return None
        visit_pass = getattr(obj, "visit_pass", None)
        if visit_pass is None:
            return None
        return {"token": visit_pass.token, "expires_at": visit_pass.expires_at}


class SimulateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[PaymentStatus.SUCCEEDED, PaymentStatus.FAILED])


class PublicMethodField(serializers.ChoiceField):
    def __init__(self, **kwargs):
        super().__init__(choices=[Method.CARD, Method.MOMO], **kwargs)


class VisitorMethodField(serializers.ChoiceField):
    """Visites et dons : carte, mobile money, ou Compte d'Avoir si l'appelant est connecté."""

    def __init__(self, **kwargs):
        super().__init__(choices=[Method.CARD, Method.MOMO, Method.WALLET], **kwargs)


class SignupPaymentSerializer(serializers.Serializer):
    artist = serializers.CharField(max_length=80, help_text="Identifiant renvoyé par l'inscription (champ id).")
    method = PublicMethodField()


class PayerSerializer(serializers.Serializer):
    payer_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    payer_email = serializers.EmailField(required=False, allow_blank=True, default="")
    payer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")


class VisitPaymentSerializer(PayerSerializer):
    artist = serializers.CharField(max_length=80)
    method = VisitorMethodField()
    region = serializers.ChoiceField(choices=Region.choices, help_text="Zone de résidence du visiteur.")


class DonationSerializer(PayerSerializer):
    artist = serializers.CharField(max_length=80)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    region = serializers.ChoiceField(choices=Region.choices)
    method = VisitorMethodField()
    message = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        attrs["currency"] = CURRENCY_OF_REGION[attrs["region"]]
        return attrs


class BalanceSerializer(serializers.Serializer):
    currency = serializers.CharField()
    available = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_payouts = serializers.DecimalField(max_digits=12, decimal_places=2)
    paid_out = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_earned = serializers.DecimalField(max_digits=12, decimal_places=2)
    provision = serializers.DecimalField(max_digits=12, decimal_places=2)


class TransactionSerializer(serializers.ModelSerializer):
    direction = serializers.SerializerMethodField()
    artist_share = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, allow_null=True)
    donor_name = serializers.SerializerMethodField()
    message = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ["reference", "purpose", "direction", "method", "status", "currency", "amount_ht", "vat",
                  "amount_ttc", "artist_share", "donor_name", "message", "created_at", "paid_at"]
        read_only_fields = fields

    def get_direction(self, obj) -> str:
        """received : visite ou don reçu ; paid : frais payés par l'artiste."""
        return "received" if obj.purpose in (Purpose.VISIT, Purpose.DONATION) else "paid"

    def get_donor_name(self, obj) -> str:
        return obj.payer_name if obj.purpose == Purpose.DONATION else ""

    def get_message(self, obj) -> str:
        return (obj.metadata or {}).get("message", "") if obj.purpose == Purpose.DONATION else ""


class PayoutCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.ChoiceField(choices=["XOF", "EUR", "USD"])
    channel = serializers.ChoiceField(choices=PayoutChannel.choices)


class PayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutRequest
        fields = ["id", "amount", "currency", "channel", "destination", "status", "note", "created_at", "processed_at"]
        read_only_fields = fields


class QuoteSerializer(serializers.Serializer):
    """Facture d'un tarif (montants en chaînes)."""

    amount_ht = serializers.CharField()
    vat = serializers.CharField()
    amount_ttc = serializers.CharField()
    currency = serializers.CharField()


class PaymentSummarySerializer(serializers.Serializer):
    """Paiement créé, tel que renvoyé au frontend par tous les modules."""

    reference = serializers.CharField()
    purpose = serializers.CharField()
    method = serializers.CharField()
    status = serializers.CharField()
    amount_ht = serializers.DecimalField(max_digits=12, decimal_places=2)
    vat = serializers.DecimalField(max_digits=12, decimal_places=2)
    amount_ttc = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField()
