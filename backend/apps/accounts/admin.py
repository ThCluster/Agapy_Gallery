from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm as BaseUserChangeForm
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm

from apps.core.phone import normalize_phone

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


@admin.register(ArtistProfile)
class ArtistProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "phone", "civility", "country", "city", "status", "red_listed_until", "created_at")
    list_filter = ("status", "civility", "country")
    search_fields = ("slug", "artist_name", "org_name", "last_name", "first_names", "user__phone", "user__email")
    readonly_fields = ("slug", "user", "accepted_terms_at", "activated_at", "created_at", "updated_at")
    list_select_related = ("user",)
    actions = ["activate", "red_list", "exclude_permanently"]
    fieldsets = (
        (None, {"fields": ("slug", "user", "status", "red_listed_until")}),
        ("Identité", {"fields": ("civility", "last_name", "first_names", "birth_date", "birth_place", "artist_name",
                                 "org_name", "founded_date", "founded_place")}),
        ("Coordonnées", {"fields": ("country", "city", "village", "gps", "photo", "bio", "website", "facebook", "instagram")}),
        ("Versements", {"fields": ("payout_momo", "momo_operator", "momo_number", "payout_iban", "iban", "account_holder", "bank_name")}),
        ("Suivi", {"fields": ("accepted_terms_at", "activated_at", "created_at", "updated_at")}),
    )

    @admin.display(description="téléphone", ordering="user__phone")
    def phone(self, obj):
        return obj.user.phone_display

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
