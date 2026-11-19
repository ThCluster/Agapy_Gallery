from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import PhoneLoginMixin, _password
from apps.core.phone import format_international

from .models import VisitorProfile


class SignupCodeSerializer(PhoneLoginMixin):
    pass


class VisitorSignupSerializer(PhoneLoginMixin):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Le code contient 6 chiffres."})
    display_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    country = serializers.RegexField(r"^[A-Za-z]{2}$", error_messages={"invalid": "Code pays à 2 lettres."})
    password = serializers.CharField(max_length=128, trim_whitespace=False)
    remember = serializers.BooleanField(default=False)

    def validate_display_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Ce champ est obligatoire.", code="required")
        return value.strip()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Même règle que les artistes (8 à 12 lettres et chiffres), comparée au numéro et à l'e-mail
        _password(attrs["password"], User(phone=attrs["phone"], email=attrs.get("email", "")))
        attrs["country"] = attrs["country"].upper()
        return attrs


class VisitorProfileSerializer(serializers.ModelSerializer):
    """Profil du visiteur connecté. Le pays (zone tarifaire, devise du Compte d'Avoir) n'est pas modifiable."""

    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    phone_display = serializers.SerializerMethodField()
    region = serializers.CharField(read_only=True)

    class Meta:
        model = VisitorProfile
        fields = ["display_name", "email", "phone", "phone_display", "country", "region", "created_at", "updated_at"]
        read_only_fields = ["phone", "country", "region", "created_at", "updated_at"]

    def get_phone_display(self, obj) -> str:
        return format_international(obj.user.phone)

    def validate_display_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Ce champ est obligatoire.", code="required")
        return value.strip()

    def update(self, profile, attrs):
        user_data = attrs.pop("user", {})
        if "email" in user_data:
            profile.user.email = user_data["email"]
            profile.user.save(update_fields=["email"])
        return super().update(profile, attrs)


class VisitPassSerializer(serializers.Serializer):
    artist = serializers.CharField(source="artist.slug")
    artist_name = serializers.CharField(source="artist.display_name")
    token = serializers.CharField()
    expires_at = serializers.DateTimeField()
