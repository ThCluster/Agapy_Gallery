from django.contrib import admin

from .models import StatementLog


@admin.register(StatementLog)
class StatementLogAdmin(admin.ModelAdmin):
    list_display = ("artist", "quarter", "sms_sent", "email_sent", "created_at")
    list_filter = ("quarter", "sms_sent", "email_sent")
    search_fields = ("artist__artist_name", "artist__org_name", "artist__last_name", "artist__user__phone")
    readonly_fields = ("artist", "quarter", "message", "sms_sent", "email_sent", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
