"""
Service de /media/ en développement (DEBUG) sans exposer les pleines résolutions des œuvres.

Les fichiers sous artworks/<artiste>/ (images pleine résolution, extraits) ne sont servis que par
/api/v1/catalog/artworks/<slug>/image|excerpt/ ; seules les miniatures (artworks/<artiste>/thumbs/)
restent publiques, comme les photos d'artistes, clips, affiches, etc.

Dans config/urls.py, à la place de `static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)` :

    from apps.catalog.media import debug_media_urlpatterns
    if settings.DEBUG:
        urlpatterns += debug_media_urlpatterns()

En production, nginx applique la même règle (location /media/artworks/ interne, sauf …/thumbs/).
"""
import posixpath
import re

from django.conf import settings
from django.http import Http404
from django.urls import re_path
from django.views.static import serve

from .models import ARTWORKS_MEDIA_PREFIX, THUMBS_DIR

_PUBLIC_ARTWORK_FILE = re.compile(rf"^{re.escape(ARTWORKS_MEDIA_PREFIX)}[^/]+/{THUMBS_DIR}/[^/]+$")


def is_public_media(path: str) -> bool:
    """Chemin (relatif à MEDIA_ROOT) servable publiquement ?"""
    # Normalisation avant contrôle : « artworks/../artworks/x », barres obliques inverses, casse (Windows)
    norm = posixpath.normpath(path.replace("\\", "/")).lstrip("/").lower()
    if norm.startswith(ARTWORKS_MEDIA_PREFIX) or norm == ARTWORKS_MEDIA_PREFIX.rstrip("/"):
        return bool(_PUBLIC_ARTWORK_FILE.match(norm))
    return True


def serve_public_media(request, path, document_root=None):
    if not is_public_media(path):
        raise Http404("Fichier introuvable.")
    return serve(request, path, document_root=document_root or settings.MEDIA_ROOT)


def debug_media_urlpatterns():
    """Motif /media/… pour le serveur de développement (vide hors DEBUG, comme django.conf.urls.static)."""
    if not settings.DEBUG:
        return []
    prefix = settings.MEDIA_URL.lstrip("/")
    return [re_path(rf"^{re.escape(prefix)}(?P<path>.*)$", serve_public_media)]
