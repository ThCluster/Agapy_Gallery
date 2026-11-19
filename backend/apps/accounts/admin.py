from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm as BaseUserChangeForm
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm

from apps.core.phone import format_international, normalize_phone

from . import services
from .models import ArtistProfile, ArtistStatus, PasswordResetCode, User


class PhoneCleanMixin:
    def clean_phone(self):
        try:
            return normalize_phone(self.cleaned_data["phone"], "CI")
        except Exception:
            raise forms.ValidationError("Numéro invalide (format international conseillé : +225…).")


class UserCreationForm(PhoneCleanMixin, BaseUserCreationForm):
    class Meta:
        model = User
        fields = ("phone", "email")


class UserChangeForm(PhoneCleanMixin, BaseUserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


class ArtistInline(admin.StackedInline):
    model = ArtistProfile
    can_delete = False
    extra = 0
    fields = ("slug", "status", "civility", "artist_name", "org_name", "country", "city")
    readonly_fields = fields
    show_change_link = True


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    ordering = ("-date_joined",)
    list_display = ("phone_display", "email", "is_active", "is_staff", "date_joined", "last_login")
    list_filter = ("is_active", "is_staff", "is_superuser")
    search_fields = ("phone", "email", "artist__artist_name", "artist__org_name")
    inlines = [ArtistInline]
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("Contact", {"fields": ("email",)}),
        ("Droits", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("phone", "email", "password1", "password2")}),)

    @admin.display(description="téléphone", ordering="phone")
    def phone_display(self, obj):
        return obj.phone_display


def mask_iban(value: str) -> str:
    """« FR76 •••• •••• 1234 » : pays et clé, puis les 4 derniers caractères."""
    if not value:
        return "—"
    return f"{value[:4]} •••• •••• {value[-4:]}" if len(value) > 8 else "••••"


def mask_number(value: str) -> str:
    """« +225 •• •• •• 04 »."""
    if not value:
        return "—"
    shown = format_international(value)
    prefix = shown.split(" ", 1)[0] if shown.startswith("+") else ""
    return f"{prefix} •• •• •• {value[-2:]}".strip()


def mask_name(value: str) -> str:
    """« A••• K••• » : initiale de chaque mot."""
    if not value:
        return "—"
    return " ".join(f"{w[0]}•••" for w in value.split())


class FlaggedFilter(admin.SimpleListFilter):
    title = "à vérifier"
    parameter_name = "flagged"

    def lookups(self, request, model_admin):
        return (("yes", "À vérifier (contournement possible)"), ("no", "Non signalé"))

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.exclude(flagged_reason="")
        if self.value() == "no":
            return queryset.filter(flagged_reason="")
        return queryset


class AssistedFilter(admin.SimpleListFilter):
    title = "inscription assistée"
    parameter_name = "assisted"

    def lookups(self, request, model_admin):
        return (("yes", "Oui"), ("no", "Non"))

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.exclude(assisted_by_name="", assisted_by_phone="")
        if self.value() == "no":
            return queryset.filter(assisted_by_name="", assisted_by_phone="")
        return queryset


class ArtistProfileForm(forms.ModelForm):
    class Meta:
        model = ArtistProfile
        fields = "__all__"

    def clean_assisted_by_phone(self):
        value = self.cleaned_data.get("assisted_by_phone", "")
        if not value:
            return value
        country = self.cleaned_data.get("country") or (self.instance.country if self.instance.pk else "CI")
        try:
            return normalize_phone(value, country or "CI")
        except Exception:
            raise forms.ValidationError("Numéro invalide (format international conseillé : +225…).")


@admin.register(ArtistProfile)
class ArtistProfileAdmin(admin.ModelAdmin):
    form = ArtistProfileForm
    list_display = ("display_name", "phone", "civility", "country", "city", "status", "red_listed_until",
                    "is_flagged", "created_at")
    list_filter = ("status", FlaggedFilter, AssistedFilter, "civility", "country")
    # Pas de recherche sur l'IBAN / le numéro momo : ils sont chiffrés en base
    search_fields = ("slug", "artist_name", "org_name", "last_name", "first_names", "user__phone", "user__email",
                     "assisted_by_name", "assisted_by_phone")
    # Coordonnées de versement masquées et non modifiables ici : l'artiste les change depuis son espace
    # (mot de passe exigé, SMS d'alerte) ; les coordonnées complètes figurent sur chaque demande de versement.
    readonly_fields = ("slug", "user", "accepted_terms_at", "activated_at", "created_at", "updated_at",
                       "momo_number_masked", "iban_masked", "account_holder_masked")
    list_select_related = ("user",)
    actions = ["activate", "red_list", "exclude_permanently", "clear_flag"]
    fieldsets = (
        (None, {"fields": ("slug", "user", "status", "red_listed_until", "flagged_reason")}),
        ("Identité", {"fields": ("civility", "last_name", "first_names", "birth_date", "birth_place", "artist_name",
                                 "org_name", "founded_date", "founded_place")}),
        ("Coordonnées", {"fields": ("country", "city", "village", "gps", "photo", "bio")}),
        ("Réseaux sociaux", {"fields": ("website", "facebook", "instagram", "twitter", "tiktok")}),
        ("Inscription assistée", {"fields": ("assisted_by_name", "assisted_by_phone"),
                                  "description": "Personne de confiance qui a aidé l'artiste à s'inscrire."}),
        ("Versements", {"fields": ("payout_momo", "momo_operator", "momo_number_masked", "payout_iban",
                                   "iban_masked", "account_holder_masked", "bank_name")}),
        ("Suivi", {"fields": ("accepted_terms_at", "activated_at", "created_at", "updated_at")}),
    )

    @admin.display(description="téléphone", ordering="user__phone")
    def phone(self, obj):
        return obj.user.phone_display

    @admin.display(description="à vérifier", boolean=True)
    def is_flagged(self, obj):
        return bool(obj.flagged_reason)

    @admin.display(description="numéro mobile money")
    def momo_number_masked(self, obj):
        return mask_number(obj.momo_number)

    @admin.display(description="IBAN")
    def iban_masked(self, obj):
        return mask_iban(obj.iban)

    @admin.display(description="titulaire du compte")
    def account_holder_masked(self, obj):
        return mask_name(obj.account_holder)

    @admin.action(description="Marquer comme vérifié (retirer le signalement « à vérifier »)")
    def clear_flag(self, request, queryset):
        n = 0
        for profile in queryset.exclude(flagged_reason=""):
            profile.flagged_reason = ""
            profile.save(update_fields=["flagged_reason", "updated_at"])
            n += 1
        self.message_user(request, f"{n} signalement(s) retiré(s).", messages.SUCCESS)

    @admin.action(description="Activer le compte (frais d'ouverture reçus) et envoyer les identifiants")
    def activate(self, request, queryset):
        n = 0
        for profile in queryset.filter(status=ArtistStatus.PENDING_PAYMENT):
            services.activate_account(profile)
            n += 1
        self.message_user(request, f"{n} compte(s) activé(s).", messages.SUCCESS)

    @admin.action(description="Mettre sur liste rouge pendant 3 mois")
    def red_list(self, request, queryset):
        n = 0
        for profile in queryset:
            services.red_list_artist(profile)
            n += 1
        self.message_user(request, f"{n} artiste(s) sur liste rouge pour au moins {services.RED_LIST_DAYS} jours.",
                          messages.WARNING)

    @admin.action(description="Exclure définitivement (œuvre volée) et désactiver le compte")
    def exclude_permanently(self, request, queryset):
        n = 0
        for profile in queryset.select_related("user"):
            services.exclude_artist(profile)
            n += 1
        self.message_user(request, f"{n} artiste(s) exclu(s).", messages.WARNING)


@admin.register(PasswordResetCode)
class PasswordResetCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "attempts", "verified_at", "used_at")
    readonly_fields = ("user", "code_hash", "created_at", "expires_at", "attempts", "verified_at", "used_at")

    def has_add_permission(self, request):
        return False
