"""
Adresse IP du client, fiable derrière un proxy.

L'en-tête X-Forwarded-For est fourni par le client : on ne lui fait confiance que pour les
`NUM_PROXIES` derniers sauts, ajoutés par nos propres proxys (même règle que DRF).
Sans proxy (NUM_PROXIES=0), seule REMOTE_ADDR compte.
"""
from django.conf import settings


def client_ip(request) -> str:
    num_proxies = settings.REST_FRAMEWORK.get("NUM_PROXIES") or 0
    remote = request.META.get("REMOTE_ADDR", "")
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if num_proxies > 0 and xff:
        addrs = [a.strip() for a in xff.split(",") if a.strip()]
        if addrs:
            return addrs[-min(num_proxies, len(addrs))]
    return remote
