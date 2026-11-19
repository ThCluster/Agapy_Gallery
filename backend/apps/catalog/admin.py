"""
Modération des œuvres par l'équipe AGAPY (p. 13).

Par défaut la liste n'affiche que les œuvres en attente de validation. Refuser ou retirer
une œuvre demande un motif, transmis à l'artiste par SMS et e-mail.
"""
from django import forms
from django.contrib import admin, messages
from django.contrib.admin import helpers
from django.template.response import TemplateResponse
from django.utils.html import format_html

from . import services
from .models import Artwork, ArtworkStatus, Gallery


class StatusFilter(admin.SimpleListFilter):
    """Filtre par statut, positionné par défaut sur « En attente de validation »."""

    title = "statut"
    parameter_name = "status"
    ALL = "all"

    def lookups(self, request, model_admin):
        return [(self.ALL, "Tous"), *ArtworkStatus.choices]

    def choices(self, changelist):
        current = self.value() or ArtworkStatus.PENDING_REVIEW
        for value, label in self.lookup_choices:
            yield {
                "selected": current == value,
                "query_string": changelist.get_query_string({self.parameter_name: value}),
                "display": label,
            }

    def queryset(self, request, queryset):
        value = self.value() or ArtworkStatus.PENDING_REVIEW
        return queryset if value == self.ALL else queryset.filter(status=value)


class ReasonForm(forms.Form):
    reason = forms.CharField(label="Motif (envoyé à l'artiste)", widget=forms.Textarea(attrs={"rows": 4}), max_length=1000)


@admin.register(Artwork)
class ArtworkAdmin(admin.ModelAdmin):
    list_display = ("thumbnail", "title", "artist", "discipline", "status", "submitted_at", "published_at",
                    "recommended", "team_favorite", "view_count")
    list_display_links = ("thumbnail", "title")
    list_filter = (StatusFilter, "discipline", "recommended", "team_favorite", "is_free")
    list_editable = ("recommended", "team_favorite")
    search_fields = ("title", "slug", "artist__artist_name", "artist__org_name", "artist__last_name", "artist__user__phone")
    list_select_related = ("artist", "artist__user")
    readonly_fields = ("preview", "slug", "publication_settled", "submitted_at", "moderated_at", "published_at",
                       "view_count", "created_at", "updated_at")
    actions = ["approve", "reject", "remove_inappropriate", "remove_stolen"]
    fieldsets = (
        (None, {"fields": ("artist", "slug", "status", "moderation_reason")}),
        ("Œuvre", {"fields": ("preview", "title", "summary", "technique", "discipline", "height_cm", "width_cm",
                              "image", "excerpt", "excerpt_duration", "frame")}),
        ("Droits", {"fields": ("author_name", "author_contact", "copyright_office", "copyright_contact", "owner_certified")}),
        ("Mise en avant", {"fields": ("is_free", "recommended", "team_favorite")}),
        ("Suivi", {"fields": ("publication_settled", "submitted_at", "moderated_at", "published_at", "view_count",
                              "created_at", "updated_at")}),
    )

    @admin.display(description="")
    def thumbnail(self, obj):
        return format_html('<img src="{}" style="height:48px;border-radius:4px">', obj.image.url) if obj.image else ""

    @admin.display(description="aperçu")
    def preview(self, obj):
        return format_html('<img src="{}" style="max-height:320px">', obj.image.url) if obj.image else "—"

    # -- Actions de modération ------------------------------------------------
    @admin.action(description="Valider et publier (prévient l'artiste)")
    def approve(self, request, queryset):
        n = 0
        # Seules les œuvres en attente de validation (paiement reçu ou publication gratuite) sont publiables
        for artwork in queryset.filter(status=ArtworkStatus.PENDING_REVIEW).select_related("artist__user"):
            services.approve_artwork(artwork)
            n += 1
        self.message_user(request, f"{n} œuvre(s) publiée(s).", messages.SUCCESS)
        skipped = queryset.exclude(status=ArtworkStatus.PENDING_REVIEW).count()
        if skipped:
            self.message_user(request, f"{skipped} œuvre(s) ignorée(s) : elles ne sont pas en attente de validation.",
                              messages.WARNING)

    def _with_reason(self, request, queryset, action, title, apply):
        """Affiche un formulaire pour saisir le motif, puis applique l'action à chaque œuvre."""
        form = ReasonForm(request.POST if "apply" in request.POST else None)
        if "apply" in request.POST and form.is_valid():
            n = 0
            for artwork in queryset.select_related("artist__user"):
                apply(artwork, form.cleaned_data["reason"])
                n += 1
            return n
        context = {
            **self.admin_site.each_context(request),
            "title": title,
            "form": form,
            "queryset": queryset,
            "action": action,
            "opts": self.model._meta,
            "action_checkbox_name": helpers.ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, "admin/catalog/artwork/reason.html", context)

    @admin.action(description="Refuser (avec motif)")
    def reject(self, request, queryset):
        queryset = queryset.exclude(status=ArtworkStatus.REMOVED)
        result = self._with_reason(request, queryset, "reject", "Refuser des œuvres", services.reject_artwork)
        if isinstance(result, int):
            self.message_user(request, f"{result} œuvre(s) refusée(s).", messages.WARNING)
            return None
        return result

    @admin.action(description="Retirer — œuvre inappropriée (sans remboursement, liste rouge 3 mois)")
    def remove_inappropriate(self, request, queryset):
        queryset = queryset.exclude(status=ArtworkStatus.REMOVED)
        result = self._with_reason(request, queryset, "remove_inappropriate", "Retirer des œuvres inappropriées",
                                   services.remove_inappropriate)
        if isinstance(result, int):
            self.message_user(request, f"{result} œuvre(s) retirée(s), artiste(s) sur liste rouge.", messages.WARNING)
            return None
        return result

    @admin.action(description="Retirer — œuvre volée (exclusion définitive de l'artiste)")
    def remove_stolen(self, request, queryset):
        queryset = queryset.exclude(status=ArtworkStatus.REMOVED)
        result = self._with_reason(request, queryset, "remove_stolen", "Retirer des œuvres volées", services.remove_stolen)
        if isinstance(result, int):
            self.message_user(request, f"{result} œuvre(s) retirée(s), artiste(s) exclu(s).", messages.WARNING)
            return None
        return result


@admin.register(Gallery)
class GalleryAdmin(admin.ModelAdmin):
    list_display = ("address_number", "artist", "is_free", "free_until", "currently_free", "free_publication_used")
    list_filter = ("is_free", "free_publication_used")
    search_fields = ("artist__artist_name", "artist__org_name", "artist__slug", "address_number")
    readonly_fields = ("address_number", "created_at", "updated_at")
    list_select_related = ("artist",)
    raw_id_fields = ("artist",)

    @admin.display(description="gratuite aujourd'hui", boolean=True)
    def currently_free(self, obj):
        return obj.currently_free
