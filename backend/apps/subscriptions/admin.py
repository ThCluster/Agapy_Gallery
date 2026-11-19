from datetime import timedelta

from django.contrib import admin, messages
from django.utils import timezone

from apps.accounts.models import ArtistStatus

from . import services
from .models import PeriodKind, Subscription, SubscriptionPeriod, SubscriptionReminder, Wallet, WalletEntry


class StateFilter(admin.SimpleListFilter):
    title = "état"
    parameter_name = "state"

    def lookups(self, request, model_admin):
        return [("active", "Actif"), ("soon", "Expire sous 30 jours"), ("standby", "En veille / échu")]

    def queryset(self, request, queryset):
        now = timezone.now()
        soon = now + timedelta(days=services.SOON_DAYS)
        if self.value() == "active":
            return queryset.filter(expires_at__gt=soon).exclude(artist__status=ArtistStatus.DORMANT)
        if self.value() == "soon":
            return queryset.filter(expires_at__gt=now, expires_at__lte=soon).exclude(artist__status=ArtistStatus.DORMANT)
        if self.value() == "standby":
            from django.db.models import Q
            return queryset.filter(Q(expires_at__lte=now) | Q(artist__status=ArtistStatus.DORMANT))
        return queryset


class ReadOnlyInline(admin.TabularInline):
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class PeriodInline(ReadOnlyInline):
    model = SubscriptionPeriod
    fields = readonly_fields = ["kind", "starts_at", "ends_at", "payment", "note", "created_at"]


class ReminderInline(ReadOnlyInline):
    model = SubscriptionReminder
    fields = readonly_fields = ["kind", "expires_at", "sent_at"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["artist", "started_at", "expires_at", "state", "artist_status"]
    list_filter = [StateFilter, "artist__status"]
    search_fields = ["artist__artist_name", "artist__org_name", "artist__last_name", "artist__user__phone"]
    list_select_related = ["artist"]
    readonly_fields = ["artist", "started_at", "expires_at", "created_at", "updated_at"]
    inlines = [PeriodInline, ReminderInline]
    actions = ["extend_one_year"]

    def has_add_permission(self, request):
        return False

    @admin.display(description="état")
    def state(self, obj):
        return {"active": "Actif", "soon": "Expire bientôt", "standby": "En veille"}[services.state_of(obj)]

    @admin.display(description="statut du compte")
    def artist_status(self, obj):
        return obj.artist.get_status_display()

    @admin.action(description="Prolonger d'un an (paiement reçu hors ligne)")
    def extend_one_year(self, request, queryset):
        for sub in queryset.select_related("artist"):
            services.renew(sub.artist, kind=PeriodKind.OFFLINE, note=f"Prolongé par {request.user}")
        self.message_user(request, f"{queryset.count()} abonnement(s) prolongé(s) d'un an.", messages.SUCCESS)


class EntryInline(ReadOnlyInline):
    model = WalletEntry
    fields = readonly_fields = ["created_at", "label", "amount", "balance_after", "payment"]


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    """Lecture seule : le solde ne change que par des mouvements (recharges, paiements)."""

    list_display = ["artist", "is_active", "balance", "currency", "updated_at"]
    list_filter = ["is_active", "currency"]
    search_fields = ["artist__artist_name", "artist__org_name", "artist__last_name", "artist__user__phone"]
    readonly_fields = ["artist", "is_active", "balance", "currency", "created_at", "updated_at"]
    inlines = [EntryInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WalletEntry)
class WalletEntryAdmin(admin.ModelAdmin):
    list_display = ["created_at", "wallet", "label", "amount", "balance_after", "payment"]
    list_filter = ["wallet__currency"]
    search_fields = ["label", "payment__reference", "wallet__artist__user__phone"]
    readonly_fields = ["wallet", "amount", "balance_after", "label", "payment", "created_at"]
    list_select_related = ["wallet__artist", "payment"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
