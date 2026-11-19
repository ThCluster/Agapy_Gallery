"""Configuration Gunicorn d'AGAPY-GALLERY (Linux uniquement : Gunicorn ne fonctionne pas sous Windows)."""
import multiprocessing
import os

bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:8010")
workers = int(os.environ.get("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
threads = int(os.environ.get("GUNICORN_THREADS", 2))
worker_class = "gthread"
# Téléversements de vidéos (50 Mo) sur des connexions lentes : nginx met le corps en mémoire tampon,
# Gunicorn le reçoit donc d'un coup ; 60 s suffisent largement.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 60))
graceful_timeout = 30
keepalive = 5
# Recycle les processus régulièrement (fuites mémoire éventuelles)
max_requests = 1000
max_requests_jitter = 100
# Journaux sur la sortie standard (journald / Docker) ; pas de journal d'accès (nginx le tient déjà)
accesslog = None
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOGLEVEL", "info")
# nginx est le seul proxy de confiance
forwarded_allow_ips = os.environ.get("GUNICORN_FORWARDED_ALLOW_IPS", "127.0.0.1")
proc_name = "agapy-gallery"
