"""
Validation des données reçues par l'API des comptes.

Les règles reprennent celles du frontend (features/signup/schema.ts, features/auth/loginSchema.ts) :
le frontend les vérifie pour le confort de l'utilisateur, le backend pour la sécurité.
"""
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.core.phone import format_international, normalize_phone, phone_region
from apps.core.uploads import ImageValidator

from .models import ArtistProfile, ArtistStatus, Civility, MomoOperator, User
from .validators import normalize_iban, validate_gps, validate_iban


def _phone(value: str, country: str, field: str) -> str:
    try:
        return normalize_phone(value, country)
    except DjangoValidationError as e:
        raise serializers.ValidationError({field: serializers.ErrorDetail(e.messages[0], code="phone_invalid")})


def _password(password: str, user=None, field: str = "password") -> None:
    try:
        validate_password(password, user)
    except DjangoValidationError as e:
        raise serializers.ValidationError({field: [serializers.ErrorDetail(m.message, code=m.code) for m in e.error_list]})


class PhoneLoginMixin(serializers.Serializer):
    """Numéro saisi + pays sélectionné → numéro E.164 dans validated_data["phone"]."""

    phone_country = serializers.CharField(min_length=2, max_length=2, default="CI")
    phone = serializers.CharField(max_length=30)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs["phone"] = _phone(attrs["phone"], attrs["phone_country"], "phone")
        return attrs


# ---------------------------------------------------------------------------
# Connexion et mot de passe
# ---------------------------------------------------------------------------
class LoginSerializer(PhoneLoginMixin):
    password = serializers.CharField(max_length=128, trim_whitespace=False)
    remember = serializers.BooleanField(default=False)


class ForgotRequestSerializer(PhoneLoginMixin):
    pass


class ForgotVerifySerializer(PhoneLoginMixin):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Le code contient 6 chiffres."})


class ForgotResetSerializer(serializers.Serializer):
    reset_token = serializers.CharField()
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(max_length=128, trim_whitespace=False)
    new_password = serializers.CharField(max_length=128, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError(
                {"current_password": serializers.ErrorDetail("Mot de passe actuel incorrect.", code="password_incorrect")}
            )
        _password(attrs["new_password"], user, "new_password")
        return attrs


# ---------------------------------------------------------------------------
# Lecture du compte connecté
# ---------------------------------------------------------------------------
class ArtistProfileSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)
    display_name = serializers.CharField(read_only=True)
    region = serializers.CharField(read_only=True)
    is_red_listed = serializers.BooleanField(read_only=True)
    momo_number_display = serializers.SerializerMethodField()

    class Meta:
        model = ArtistProfile
        fields = [
            "id", "display_name", "status", "region", "civility",
            "last_name", "first_names", "birth_date", "birth_place", "artist_name",
            "org_name", "founded_date", "founded_place",
            "country", "city", "village", "gps", "photo", "bio", "website", "facebook", "instagram",
            "payout_momo", "momo_operator", "momo_number", "momo_number_display",
            "payout_iban", "iban", "account_holder", "bank_name",
            "is_red_listed", "red_listed_until", "activated_at", "created_at",
        ]
        read_only_fields = fields

    def get_momo_number_display(self, obj) -> str:
        return format_international(obj.momo_number) if obj.momo_number else ""


class MeSerializer(serializers.ModelSerializer):
    phone_display = serializers.CharField(read_only=True)
    artist = ArtistProfileSerializer(read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ["id", "phone", "phone_display", "email", "is_staff", "last_login", "artist"]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not hasattr(instance, "artist"):
            data["artist"] = None
        return data


# ---------------------------------------------------------------------------
# Inscription d'un artiste (5 étapes du frontend, envoyées en une fois, en multipart)
# ---------------------------------------------------------------------------
class SignupSerializer(serializers.Serializer):
    civility = serializers.ChoiceField(choices=Civility.choices)
    # Personne physique
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    first_names = serializers.CharField(max_length=150, required=False, allow_blank=True)
    birth_date = serializers.DateField(required=False, allow_null=True)
    birth_place = serializers.CharField(max_length=150, required=False, allow_blank=True)
    artist_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    # Fondation ou groupement
    org_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    founded_date = serializers.DateField(required=False, allow_null=True)
    founded_place = serializers.CharField(max_length=150, required=False, allow_blank=True)
    # Coordonnées
    phone_country = serializers.CharField(min_length=2, max_length=2)
    phone = serializers.CharField(max_length=30)
    email = serializers.EmailField()
    country = serializers.CharField(min_length=2, max_length=2)
    city = serializers.CharField(max_length=120)
    village = serializers.CharField(max_length=120, required=False, allow_blank=True)
    gps = serializers.CharField(max_length=60, required=False, allow_blank=True, validators=[validate_gps])
    # Format réel contrôlé (JPEG/PNG/WebP) ; la taille garde son code « photo_size » (validate_photo)
    photo = serializers.ImageField(validators=[ImageValidator()])
    website = serializers.URLField(required=False, allow_blank=True)
    facebook = serializers.URLField(required=False, allow_blank=True)
    instagram = serializers.URLField(required=False, allow_blank=True)
    # Compte de récupération des fonds
    payout_momo = serializers.BooleanField(default=False)
    momo_operator = serializers.ChoiceField(choices=MomoOperator.choices, required=False, allow_blank=True)
    momo_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    payout_iban = serializers.BooleanField(default=False)
    iban = serializers.CharField(max_length=50, required=False, allow_blank=True)
    account_holder = serializers.CharField(max_length=150, required=False, allow_blank=True)
    bank_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    accept_terms = serializers.BooleanField()

    def validate_photo(self, photo):
        if photo.size > settings.PROFILE_PHOTO_MAX_BYTES:
            raise serializers.ValidationError("La photo ne doit pas dépasser 5 Mo.", code="photo_size")
        return photo

    def validate(self, d):
        errors = {}

        def need(field, ok, message="Ce champ est obligatoire.", code="required"):
            if not ok and field not in errors:
                errors[field] = [serializers.ErrorDetail(message, code=code)]

        today = timezone.localdate()
        if d["civility"] == Civility.ORG:
            need("org_name", d.get("org_name"))
            need("founded_date", d.get("founded_date"))
            if d.get("founded_date"):
                need("founded_date", d["founded_date"] <= today, "La date ne peut pas être dans le futur.", "future_date")
            need("founded_place", d.get("founded_place"))
        else:
            for f in ("last_name", "first_names", "birth_date", "birth_place", "artist_name"):
                need(f, d.get(f))
            if d.get("birth_date"):
                need("birth_date", d["birth_date"] <= today, "La date ne peut pas être dans le futur.", "future_date")

        try:
            d["phone"] = normalize_phone(d["phone"], d["phone_country"])
        except DjangoValidationError:
            need("phone", False, "Numéro de téléphone invalide.", "phone_invalid")

        # Au moins un moyen de recevoir ses gains : mobile money et/ou IBAN
        need("payout_momo", d.get("payout_momo") or d.get("payout_iban"),
             "Choisissez au moins un moyen de versement.", "payout_required")
        if d.get("payout_momo"):
            need("momo_operator", d.get("momo_operator"))
            need("momo_number", d.get("momo_number"))
            if d.get("momo_number"):
                try:
                    d["momo_number"] = normalize_phone(d["momo_number"], d["phone_country"])
                except DjangoValidationError:
                    need("momo_number", False, "Numéro de téléphone invalide.", "phone_invalid")
        if d.get("payout_iban"):
            need("account_holder", d.get("account_holder"))
            need("iban", d.get("iban"))
            if d.get("iban"):
                try:
                    validate_iban(d["iban"])
                    d["iban"] = normalize_iban(d["iban"])
                except DjangoValidationError:
                    need("iban", False, "IBAN invalide.", "iban_invalid")

        need("accept_terms", d.get("accept_terms"), "Vous devez accepter les conditions générales.", "terms_required")

        if "phone" not in errors:
            existing = User.objects.filter(phone=d["phone"]).select_related("artist").first()
            if existing is not None:
                pending = getattr(existing, "artist", None) is not None and existing.artist.status == ArtistStatus.PENDING_PAYMENT
                need("phone", pending, "Ce numéro est déjà associé à un compte AGAPY-GALLERY.", "phone_taken")
                d["_existing"] = existing

        if errors:
            raise serializers.ValidationError(errors)
        return d

    PROFILE_FIELDS = [
        "civility", "last_name", "first_names", "birth_date", "birth_place", "artist_name",
        "org_name", "founded_date", "founded_place", "country", "city", "village", "gps", "photo",
        "website", "facebook", "instagram", "payout_momo", "momo_operator", "momo_number",
        "payout_iban", "iban", "account_holder", "bank_name",
    ]

    @transaction.atomic
    def create(self, d):
        profile_data = {f: d.get(f) for f in self.PROFILE_FIELDS if d.get(f) is not None}
        profile_data["country"] = d["country"].upper()
        if not d.get("payout_momo"):
            profile_data.update(momo_operator="", momo_number="")
        if not d.get("payout_iban"):
            profile_data.update(iban="", account_holder="", bank_name="")

        user = d.get("_existing")
        if user is None:
            # Le compte reste inactif, sans mot de passe, jusqu'au paiement des frais d'ouverture
            user = User.objects.create_user(phone=d["phone"], email=d["email"], is_active=False)
            profile = ArtistProfile(user=user)
        else:
            # Inscription déjà commencée mais jamais payée : on la remplace
            user.email = d["email"]
            user.save(update_fields=["email"])
            profile = user.artist
            profile.slug = ""  # recalculé à partir du nouveau nom

        for field, value in profile_data.items():
            setattr(profile, field, value)
        profile.status = ArtistStatus.PENDING_PAYMENT
        profile.accepted_terms_at = timezone.now()
        profile.save()
        return profile


# ---------------------------------------------------------------------------
# Modifications depuis l'espace artiste (page Profil)
# ---------------------------------------------------------------------------
class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Cahier des charges p. 10 et 17 : toutes les informations sont modifiables par l'artiste,
    sauf le numéro de téléphone (identifiant de connexion) et la civilité.
    Le pays non plus : il fixe la zone tarifaire et la devise du Compte d'Avoir (changement par l'équipe).
    """

    email = serializers.EmailField(source="user.email", required=False)

    class Meta:
        model = ArtistProfile
        fields = [
            "email", "last_name", "first_names", "birth_date", "birth_place", "artist_name",
            "org_name", "founded_date", "founded_place",
            "country", "city", "village", "gps", "photo", "bio", "website", "facebook", "instagram",
        ]
        read_only_fields = ["country"]
        extra_kwargs = {"photo": {"required": False}}

    def _not_future(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("La date ne peut pas être dans le futur.", code="future_date")
        return value

    def validate_birth_date(self, value):
        return self._not_future(value)

    def validate_founded_date(self, value):
        return self._not_future(value)

    def validate_photo(self, photo):
        if photo and photo.size > settings.PROFILE_PHOTO_MAX_BYTES:
            raise serializers.ValidationError("La photo ne doit pas dépasser 5 Mo.", code="photo_size")
        return photo

    def validate(self, attrs):
        # Les champs obligatoires à l'inscription ne peuvent pas être vidés
        if self.instance.is_org:
            required = ["org_name", "founded_date", "founded_place", "city"]
        else:
            required = ["last_name", "first_names", "birth_date", "birth_place", "artist_name", "city"]
        errors = {
            f: [serializers.ErrorDetail("Ce champ est obligatoire.", code="required")]
            for f in required
            if f in attrs and (attrs[f] is None or (isinstance(attrs[f], str) and not attrs[f].strip()))
        }
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    @transaction.atomic
    def update(self, profile, attrs):
        user_data = attrs.pop("user", {})
        if "email" in user_data:
            profile.user.email = user_data["email"]
            profile.user.save(update_fields=["email"])
        return super().update(profile, attrs)


class PayoutSerializer(serializers.ModelSerializer):
    PAYOUT_FIELDS = ["payout_momo", "momo_operator", "momo_number", "payout_iban", "iban", "account_holder", "bank_name"]

    # Obligatoire même en PATCH partiel (vérifié dans validate) : un jeton d'accès volé ne suffit pas
    current_password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True, required=False)

    class Meta:
        model = ArtistProfile
        fields = ["current_password", "payout_momo", "momo_operator", "momo_number", "payout_iban", "iban",
                  "account_holder", "bank_name"]

    def validate(self, attrs):
        p = self.instance
        current = attrs.pop("current_password", None)
        if not current:
            raise serializers.ValidationError(
                {"current_password": [serializers.ErrorDetail("Ce champ est obligatoire.", code="required")]}
            )
        if not p.user.check_password(current):
            raise serializers.ValidationError(
                {"current_password": [serializers.ErrorDetail("Mot de passe actuel incorrect.", code="password_incorrect")]}
            )
        merged = {f: attrs.get(f, getattr(p, f)) for f in self.PAYOUT_FIELDS}
        errors = {}
        if not (merged["payout_momo"] or merged["payout_iban"]):
            errors["payout_momo"] = [serializers.ErrorDetail("Choisissez au moins un moyen de versement.", code="payout_required")]
        if merged["payout_momo"]:
            if not merged["momo_operator"]:
                errors["momo_operator"] = [serializers.ErrorDetail("Ce champ est obligatoire.", code="required")]
            if not merged["momo_number"]:
                errors["momo_number"] = [serializers.ErrorDetail("Ce champ est obligatoire.", code="required")]
            elif "momo_number" in attrs:
                try:
                    # Sans indicatif, le numéro est lu dans le pays du numéro de connexion
                    attrs["momo_number"] = normalize_phone(attrs["momo_number"], phone_region(p.user.phone) or p.country)
                except DjangoValidationError:
                    errors["momo_number"] = [serializers.ErrorDetail("Numéro de téléphone invalide.", code="phone_invalid")]
        if merged["payout_iban"]:
            if not merged["account_holder"]:
                errors["account_holder"] = [serializers.ErrorDetail("Ce champ est obligatoire.", code="required")]
            if not merged["iban"]:
                errors["iban"] = [serializers.ErrorDetail("Ce champ est obligatoire.", code="required")]
            elif "iban" in attrs:
                try:
                    validate_iban(attrs["iban"])
                    attrs["iban"] = normalize_iban(attrs["iban"])
                except DjangoValidationError:
                    errors["iban"] = [serializers.ErrorDetail("IBAN invalide.", code="iban_invalid")]
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
