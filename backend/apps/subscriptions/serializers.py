from rest_framework import serializers

from apps.payments.serializers import PaymentSummarySerializer, QuoteSerializer  # noqa: F401  (réexporté)

from .models import Wallet, WalletEntry



class SubscriptionSerializer(serializers.Serializer):
    opened_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField()
    state = serializers.ChoiceField(choices=["active", "soon", "standby"])
    days_left = serializers.IntegerField()
    renewal_quote = QuoteSerializer()


class RenewSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=["card", "momo", "wallet"])



class PaymentStartSerializer(serializers.Serializer):
    payment = PaymentSummarySerializer()
    action = serializers.DictField()


class WalletEntrySerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    balance_after = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    payment = serializers.SlugRelatedField(slug_field="reference", read_only=True)
    date = serializers.DateTimeField(source="created_at")

    class Meta:
        model = WalletEntry
        fields = ["id", "date", "label", "amount", "balance_after", "payment"]


class WalletSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True, read_only=True)

    class Meta:
        model = Wallet
        fields = ["is_active", "balance", "currency"]
        read_only_fields = ["balance", "currency"]


class WalletUpdateSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class TopupSerializer(serializers.Serializer):
    amount = serializers.CharField(max_length=20)
    method = serializers.ChoiceField(choices=["card", "momo"])
