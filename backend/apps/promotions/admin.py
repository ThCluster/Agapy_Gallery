from django.contrib import admin, messages

from . import services
from .models import AdCampaign, Clip, ClipStatus, LiveStream


@admin.register(Clip)
class ClipAdmin(admin.ModelAdmin):
    list_display = ["title", "advertiser", "status", "duration_seconds", "paid_at", "starts_at", "ends_at"]
    list_filter = ["status"]
    search_fields = ["title", "advertiser", "contact_phone", "contact_email"]
    readonly_fields = ["status", "paid_at", "starts_at", "ends_at", "created_at", "artist"]
    actions = ["approve", "reject", "refresh"]

    @admin.action(description="Approuver (entre dans la file de diffusion)")
    def approve(self, request, queryset):
        count = sum(services.approve_clip(clip) for clip in queryset.filter(status=ClipStatus.PENDING_REVIEW))
        self.message_user(request, f"{count} clip(s) approuvé(s).", messages.SUCCESS)
        skipped = queryset.exclude(status=ClipStatus.PENDING_REVIEW).count()
        if skipped:
            self.message_user(request, f"{skipped} clip(s) ignoré(s) : ils ne sont pas en attente de validation.",
                              messages.WARNING)

    @admin.action(description="Rejeter (clip inapproprié)")
    def reject(self, request, queryset):
        count = 0
        for clip in queryset.exclude(status=ClipStatus.REJECTED):
            services.reject_clip(clip, reason="Rejeté par l'équipe AGAPY")
            count += 1
        self.message_user(request, f"{count} clip(s) rejeté(s).", messages.SUCCESS)

    @admin.action(description="Mettre à jour la file de diffusion")
    def refresh(self, request, queryset):
        started = services.refresh_queue()
        self.message_user(request, f"{started} clip(s) mis en diffusion.", messages.SUCCESS)


@admin.register(AdCampaign)
class AdCampaignAdmin(admin.ModelAdmin):
    list_display = ["advertiser", "format", "starts_at", "ends_at", "is_active", "weight"]
    list_filter = ["format", "is_active"]
    list_editable = ["is_active", "weight"]
    search_fields = ["advertiser"]


@admin.register(LiveStream)
class LiveStreamAdmin(admin.ModelAdmin):
    list_display = ["title", "starts_at", "ends_at", "is_live"]
    list_filter = ["is_live"]
    list_editable = ["is_live"]
    search_fields = ["title"]
