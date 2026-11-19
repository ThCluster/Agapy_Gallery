from django.contrib import admin
from django.utils import timezone

from .models import Category, Post, Report, Topic


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "order", "is_active"]
    list_editable = ["order", "is_active"]
    prepopulated_fields = {"slug": ["name"]}


class PostInline(admin.TabularInline):
    model = Post
    extra = 0
    fields = ["author", "body", "is_hidden", "created_at"]
    readonly_fields = ["author", "created_at"]
    show_change_link = True


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "author", "is_pinned", "is_locked", "is_hidden", "last_post_at"]
    list_filter = ["category", "is_pinned", "is_locked", "is_hidden"]
    list_editable = ["is_pinned", "is_locked"]
    search_fields = ["title", "body", "author__artist_name", "author__org_name", "author__last_name"]
    raw_id_fields = ["author"]
    actions = ["pin", "unpin", "lock", "unlock"]
    inlines = [PostInline]

    @admin.action(description="Épingler")
    def pin(self, request, qs):
        qs.update(is_pinned=True)

    @admin.action(description="Désépingler")
    def unpin(self, request, qs):
        qs.update(is_pinned=False)

    @admin.action(description="Verrouiller")
    def lock(self, request, qs):
        qs.update(is_locked=True)

    @admin.action(description="Déverrouiller")
    def unlock(self, request, qs):
        qs.update(is_locked=False)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["__str__", "topic", "author", "is_hidden", "created_at"]
    list_filter = ["is_hidden"]
    search_fields = ["body", "topic__title"]
    raw_id_fields = ["author", "topic"]
    actions = ["hide", "unhide"]

    @admin.action(description="Masquer")
    def hide(self, request, qs):
        qs.update(is_hidden=True)

    @admin.action(description="Rendre visible")
    def unhide(self, request, qs):
        qs.update(is_hidden=False)


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["__str__", "post", "reason", "is_handled", "created_at"]
    list_filter = ["is_handled"]
    raw_id_fields = ["post"]
    readonly_fields = ["ip_address", "created_at", "handled_at"]
    actions = ["mark_handled", "hide_and_handle"]

    @admin.action(description="Marquer comme traité")
    def mark_handled(self, request, qs):
        qs.update(is_handled=True, handled_at=timezone.now())

    @admin.action(description="Masquer le message et marquer comme traité")
    def hide_and_handle(self, request, qs):
        Post.objects.filter(reports__in=qs).update(is_hidden=True)
        qs.update(is_handled=True, handled_at=timezone.now())

    def save_model(self, request, obj, form, change):
        if obj.is_handled and not obj.handled_at:
            obj.handled_at = timezone.now()
        super().save_model(request, obj, form, change)
