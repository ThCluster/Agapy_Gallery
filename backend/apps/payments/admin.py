from django.contrib import admin, messages

from . import services
from .models import LedgerEntry, Payment, PayoutRequest, PayoutStatus, VisitLog, VisitPass


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class LedgerInline(admin.TabularInline):
    model = LedgerEntry
    fk_name = "payment"
    fields = ("account", "amount", "currency", "direction", "label")
    readonly_fields = fields
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Payment)
class PaymentAdmin(ReadOnlyAdmin):
    list_display = ("reference", "purpose", "status", "method", "region", "amount_ttc", "currency", "artist",
                    "created_at", "paid_at")
    list_filter = ("purpose", "status", "method", "region")
    search_fields = ("reference", "provider_ref", "payer_email", "payer_phone", "artist__slug")
    date_hierarchy = "created_at"
    list_select_related = ("artist",)
    inlines = [LedgerInline]


@admin.register(LedgerEntry)
class LedgerEntryAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "account", "direction", "amount", "currency", "artist", "payment", "label")
    list_filter = ("account", "direction", "currency")
    search_fields = ("artist__slug", "payment__reference")
    date_hierarchy = "created_at"
    list_select_related = ("artist", "payment")


@admin.register(PayoutRequest)
class PayoutRequestAdmin(admin.ModelAdmin):
    list_display = ("created_at", "artist", "amount", "currency", "channel", "destination", "status", "processed_at")
    list_filter = ("status", "channel", "currency")
    search_fields = ("artist__slug", "destination")
    readonly_fields = ("artist", "amount", "currency", "channel", "destination", "status", "created_at",
                       "processed_at", "processed_by")
    actions = ["mark_paid", "reject"]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Marquer comme versé")
    def mark_paid(self, request, queryset):
        """Refusé tant que le paiement est simulé, ou si la demande repose sur des paiements simulés."""
        done, refused = 0, []
        for payout in queryset.filter(status=PayoutStatus.PENDING):
            try:
                done += services.mark_payout_paid(payout, by=request.user)
            except services.PaymentError as exc:
                refused.append(f"{payout} : {exc.message}")
        if done:
            self.message_user(request, f"{done} versement(s) enregistré(s).", messages.SUCCESS)
        for line in refused:
            self.message_user(request, f"Refusé — {line}", messages.ERROR)
        if not done and not refused:
            self.message_user(request, "Aucune demande en attente sélectionnée.", messages.WARNING)

    @admin.action(description="Refuser la demande")
    def reject(self, request, queryset):
        done = sum(services.reject_payout(p, by=request.user) for p in queryset.filter(status=PayoutStatus.PENDING))
        self.message_user(request, f"{done} demande(s) refusée(s).", messages.WARNING)


@admin.register(VisitPass)
class VisitPassAdmin(ReadOnlyAdmin):
    list_display = ("artist", "created_at", "expires_at", "payment")
    search_fields = ("artist__slug", "payment__reference")
    list_select_related = ("artist", "payment")
    exclude = ("token",)


@admin.register(VisitLog)
class VisitLogAdmin(ReadOnlyAdmin):
    list_display = ("artist", "free", "created_at")
    list_filter = ("free",)
    search_fields = ("artist__slug",)
    date_hierarchy = "created_at"
