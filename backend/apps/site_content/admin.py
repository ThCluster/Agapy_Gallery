from django.contrib import admin, messages
from django.utils import timezone

from . import services
from .models import Broadcast, ContactMessage, NewsletterSubscriber, Page, Partner


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ["subject", "name", "email", "phone", "created_at", "is_handled"]
    list_filter = ["is_handled"]
    search_fields = ["name", "email", "subject", "message"]
    readonly_fields = ["name", "email", "phone", "subject", "message", "ip_address", "created_at", "handled_at"]
    actions = ["mark_handled", "mark_unhandled"]

    @admin.action(description="Marquer comme traité")
    def mark_handled(self, request, queryset):
        n = queryset.filter(is_handled=False).update(is_handled=True, handled_at=timezone.now())
        self.message_user(request, f"{n} message(s) marqué(s) comme traité(s).", messages.SUCCESS)

    @admin.action(description="Marquer comme non traité")
    def mark_unhandled(self, request, queryset):
        n = queryset.filter(is_handled=True).update(is_handled=False, handled_at=None)
        self.message_user(request, f"{n} message(s) marqué(s) comme non traité(s).", messages.SUCCESS)

    def has_add_permission(self, request):
        return False


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ["email", "language", "is_active", "subscribed_at", "unsubscribed_at"]
    list_filter = ["is_active", "language"]
    search_fields = ["email"]


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = ["name", "url", "order", "is_active"]
    list_editable = ["order", "is_active"]
    search_fields = ["name"]


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ["slug", "title_fr", "is_published", "updated_at"]
    list_filter = ["is_published"]
    search_fields = ["slug", "title_fr", "title_en"]


@admin.register(Broadcast)
class BroadcastAdmin(admin.ModelAdmin):
    list_display = ["title", "channel", "audience", "created_at", "sent_at", "recipient_count", "failure_count"]
    list_filter = ["channel", "audience"]
    search_fields = ["title", "message"]
    readonly_fields = ["created_at", "sent_at", "recipient_count", "failure_count"]
    actions = ["send"]

    @admin.action(description="Envoyer aux artistes")
    def send(self, request, queryset):
        sent = skipped = 0
        for b in queryset:
            if services.send_broadcast(b):
                sent += 1
            else:
                skipped += 1
        self.message_user(request, f"{sent} message(s) envoyé(s).", messages.SUCCESS)
        if skipped:
            self.message_user(request, f"{skipped} message(s) déjà envoyé(s) : non renvoyé(s).", messages.WARNING)

    def get_readonly_fields(self, request, obj=None):
        # Un message envoyé n'est plus modifiable
        if obj and obj.sent_at:
            return [f.name for f in self.model._meta.fields]
        return self.readonly_fields
