from django.contrib import admin

from .models import SignupCode, VisitorProfile


@admin.register(VisitorProfile)
class VisitorProfileAdmin(admin.ModelAdmin):
    list_display = ["display_name", "phone", "email", "country", "region", "is_active", "created_at"]
    list_filter = ["country", "user__is_active"]
    search_fields = ["display_name", "user__phone", "user__email"]
    list_select_related = ["user"]
    readonly_fields = ["user", "created_at", "updated_at"]
    fields = ["user", "display_name", "country", "created_at", "updated_at"]

    def has_add_permission(self, request):
        return False  # inscription par le site uniquement (numéro prouvé par SMS)

    @admin.display(description="téléphone", ordering="user__phone")
    def phone(self, obj):
        return obj.user.phone_display

    @admin.display(description="e-mail")
    def email(self, obj):
        return obj.user.email

    @admin.display(description="zone tarifaire")
    def region(self, obj):
        return obj.region

    @admin.display(description="actif", boolean=True)
    def is_active(self, obj):
        return obj.user.is_active


@admin.register(SignupCode)
class SignupCodeAdmin(admin.ModelAdmin):
    """Lecture seule (diagnostic) : l'empreinte du code n'est pas affichée."""

    list_display = ["phone", "created_at", "expires_at", "attempts", "used_at"]
    search_fields = ["phone"]
    fields = readonly_fields = ["phone", "created_at", "expires_at", "attempts", "used_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
