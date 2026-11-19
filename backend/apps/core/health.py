"""
Sonde de santé : GET /healthz (sans authentification), pour nginx, Docker ou un superviseur.

Vérifie la base de données et le cache. Réponse 200 {"status": "ok", ...} ou 503 {"status": "error", ...},
sans aucun détail technique (version, nom d'hôte, message d'erreur) : seulement "ok" / "error" par élément.
"""
import logging
import uuid

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe

logger = logging.getLogger("agapy.health")


def _check_database() -> bool:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception:
        logger.exception("Sonde de santé : base de données indisponible")
        return False


def _check_cache() -> bool:
    key = f"healthz:{uuid.uuid4().hex}"
    try:
        cache.set(key, "1", timeout=10)
        ok = cache.get(key) == "1"
        cache.delete(key)
        if not ok:
            logger.error("Sonde de santé : le cache ne restitue pas la valeur écrite")
        return ok
    except Exception:
        logger.exception("Sonde de santé : cache indisponible")
        return False


@never_cache
@require_safe
def healthz(request):
    checks = {"database": _check_database(), "cache": _check_cache()}
    healthy = all(checks.values())
    return JsonResponse(
        {"status": "ok" if healthy else "error", "checks": {k: "ok" if v else "error" for k, v in checks.items()}},
        status=200 if healthy else 503,
    )
