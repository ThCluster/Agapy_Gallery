from django.contrib import admin

from .models import OutboundMessage


@admin.register(OutboundMessage)
class OutboundMessageAdmin(admin.ModelAdmin):
    """Lecture seule, sans le contenu : les SMS contiennent des identifiants et des codes."""

    list_display = ["created_at", "channel", "recipient_hint", "status", "attempts", "next_attempt_at", "sent_at"]
    list_filter = ["channel", "status"]
    fields = ["channel", "recipient_hint", "status", "attempts", "next_attempt_at", "last_error", "created_at",
              "sent_at"]
    readonly_fields = fields
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
