"""
Configuration Django d'AGAPY-GALLERY.

Toutes les valeurs sensibles ou propres à un environnement viennent du fichier .env
(voir .env.example). Aucune clé ni mot de passe ne doit être écrit ici.
"""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
    CSRF_TRUSTED_ORIGINS=(list, []),
    REFRESH_COOKIE_SECURE=(bool, None),
    REFRESH_COOKIE_SAMESITE=(str, "Lax"),
    REFRESH_COOKIE_DOMAIN=(str, None),
)
environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env("DEBUG")
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Bibliothèques
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    # AGAPY-GALLERY
    "apps.core",
    "apps.notifications",
    "apps.accounts",
    "apps.catalog",
    "apps.payments",
    "apps.subscriptions",
    "apps.promotions",
    "apps.site_content",
    "apps.dashboards",
    "apps.forum",
    "apps.visitors",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.AdminLoginThrottleMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Base de données : MySQL (utf8mb4 pour les accents et les emojis)
# ---------------------------------------------------------------------------
DATABASES = {"default": env.db("DATABASE_URL")}
if "mysql" in DATABASES["default"]["ENGINE"]:
    DATABASES["default"].setdefault("OPTIONS", {}).update(
        {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        }
    )
    DATABASES["default"]["TEST"] = {"CHARSET": "utf8mb4", "COLLATION": "utf8mb4_unicode_ci"}
# Connexions persistantes (secondes) ; vérifiées avant réutilisation
DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
# Vérifications rapides sans MySQL : DATABASE_URL=sqlite:///chemin/vers/fichier.sqlite3

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Authentification
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

# Argon2 en premier : algorithme recommandé pour le stockage des mots de passe
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    # Règle du cahier des charges : 8 à 12 caractères, lettres et chiffres
    {"NAME": "apps.accounts.validators.AgapyPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
     "OPTIONS": {"user_attributes": ("phone", "email")}},
]

# ---------------------------------------------------------------------------
# API (Django REST Framework)
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.accounts.authentication.AgapyJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    # Nombre de proxys de confiance devant Django (0 en local, 1 derrière nginx) : sans ce réglage,
    # un client pourrait changer d'adresse IP à volonté avec X-Forwarded-For et contourner les limites.
    "NUM_PROXIES": env.int("NUM_PROXIES", default=0),
    # Limite générale par adresse IP (anonyme) ou par compte, plus des limites par action (throttle_scope)
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/min",
        "user": "300/min",
        "auth_login": "10/min",
        "auth_refresh": "30/min",
        "password_otp": "5/hour",
        "password_verify": "10/hour",
        "signup": "10/hour",
        "password_change": "5/hour",  # changement du mot de passe et des coordonnées de versement
        "simulate": "30/hour",  # simulateur de paiement
        "clip_create": "5/hour",  # clips promotionnels
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "API AGAPY-GALLERY",
    "DESCRIPTION": "API de la galerie d'art virtuelle AGAPY-GALLERY.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Hors développement, le schéma et Swagger sont réservés à l'équipe (session de l'administration)
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny" if DEBUG else "rest_framework.permissions.IsAdminUser"],
    "SERVE_AUTHENTICATION": [
        "rest_framework.authentication.SessionAuthentication",
        "apps.accounts.authentication.AgapyJWTAuthentication",
    ],
}

# Jetons JWT : jeton d'accès court (gardé en mémoire par le frontend) et jeton de
# rafraîchissement dans un cookie HttpOnly, renouvelé et révoqué à chaque usage.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_SIGNING_KEY"),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# Durée du jeton de rafraîchissement quand « Se souvenir de moi » n'est pas coché
REFRESH_TOKEN_SHORT_LIFETIME = timedelta(hours=12)

REFRESH_COOKIE = {
    "NAME": "agapy_refresh",
    "PATH": "/api/v1/auth/",
    "SECURE": env("REFRESH_COOKIE_SECURE") if env("REFRESH_COOKIE_SECURE") is not None else not DEBUG,
    "SAMESITE": env("REFRESH_COOKIE_SAMESITE"),
    "DOMAIN": env("REFRESH_COOKIE_DOMAIN"),
}

# Blocage après trop d'échecs de connexion : LOGIN_MAX_FAILURES par couple (numéro, adresse IP),
# LOGIN_GLOBAL_MAX_FAILURES par numéro toutes adresses confondues, pendant LOGIN_LOCKOUT.
LOGIN_MAX_FAILURES = 5
LOGIN_GLOBAL_MAX_FAILURES = 20
LOGIN_LOCKOUT = timedelta(minutes=15)
# Même principe pour la page de connexion de l'administration (par adresse IP et par identifiant)
ADMIN_LOGIN_MAX_FAILURES = 5
ADMIN_LOGIN_LOCKOUT = timedelta(minutes=15)

# Chemin de l'administration Django : à changer en production pour la soustraire aux robots
ADMIN_URL = env("ADMIN_URL", default="admin/").strip("/") + "/"

# Code de réinitialisation du mot de passe envoyé par SMS
PASSWORD_RESET_CODE_LIFETIME = timedelta(minutes=10)
PASSWORD_RESET_CODE_MAX_ATTEMPTS = 5
PASSWORD_RESET_CODE_COOLDOWN = timedelta(seconds=60)
PASSWORD_RESET_TOKEN_LIFETIME = timedelta(minutes=15)
# Plafonds par numéro : codes envoyés, et échecs de vérification cumulés sur la journée
PASSWORD_RESET_CODES_PER_HOUR = 3
PASSWORD_RESET_CODES_PER_DAY = 10
PASSWORD_RESET_VERIFY_MAX_FAILURES_PER_DAY = 10

# ---------------------------------------------------------------------------
# CORS (en développement, le plus simple reste le proxy Vite sur /api)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^/api/.*$"
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")

# ---------------------------------------------------------------------------
# Cache (compteur d'échecs de connexion, limitation de débit, jeton du fournisseur SMS).
# En production avec plusieurs processus Gunicorn : Redis, sinon chaque processus a ses propres
# compteurs et les limites sont contournables. Ex. CACHE_URL=rediscache://127.0.0.1:6379/1
# (backend django.core.cache.backends.redis.RedisCache, paquet « redis »).
# ---------------------------------------------------------------------------
CACHES = {"default": env.cache("CACHE_URL", default="locmemcache://agapy")}
CACHES["default"].setdefault("KEY_PREFIX", "agapy")

# Chiffrement des champs sensibles (apps.core.fields) et des notifications en attente.
# Générer : python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY", default=None)

# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
SMS_BACKEND = env("SMS_BACKEND", default="apps.notifications.sms.ConsoleSmsBackend")
SMS_SENDER_NAME = env("SMS_SENDER_NAME", default="AGAPY")
SMS_TIMEOUT = env.int("SMS_TIMEOUT", default=10)
# Fournisseurs prêts à l'emploi : apps/notifications/sms_providers.py
SMS_ORANGE_CLIENT_ID = env("SMS_ORANGE_CLIENT_ID", default=None)
SMS_ORANGE_CLIENT_SECRET = env("SMS_ORANGE_CLIENT_SECRET", default=None)
SMS_ORANGE_SENDER = env("SMS_ORANGE_SENDER", default=None)
SMS_ORANGE_SENDER_NAME = env("SMS_ORANGE_SENDER_NAME", default=None)
SMS_TWILIO_SID = env("SMS_TWILIO_SID", default=None)
SMS_TWILIO_TOKEN = env("SMS_TWILIO_TOKEN", default=None)
SMS_TWILIO_FROM = env("SMS_TWILIO_FROM", default=None)
SMS_HTTP_URL = env("SMS_HTTP_URL", default=None)
SMS_HTTP_HEADERS = env("SMS_HTTP_HEADERS", default=None)  # JSON
SMS_HTTP_TEMPLATE = env("SMS_HTTP_TEMPLATE", default=None)  # JSON avec {to}, {message}, {sender}
SMS_HTTP_SENDER = env("SMS_HTTP_SENDER", default=None)
# True : SMS et e-mails mis en file (chiffrés) et envoyés par « manage.py send_pending_notifications »
# lancé chaque minute (cron). False : envoi pendant la requête.
NOTIFICATIONS_ASYNC = env.bool("NOTIFICATIONS_ASYNC", default=False)

if "EMAIL_URL" in env.ENVIRON:
    vars().update(env.email("EMAIL_URL"))
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="AGAPY-GALLERY <no-reply@agapy-gallery.com>")

# ---------------------------------------------------------------------------
# Paiements (voir apps.payments.providers). FakeProvider simule le paiement en développement.
# ---------------------------------------------------------------------------
PAYMENT_PROVIDERS = {
    "card": env("PAYMENT_PROVIDER_CARD", default="apps.payments.providers.fake.FakeProvider"),
    "momo": env("PAYMENT_PROVIDER_MOMO", default="apps.payments.providers.fake.FakeProvider"),
    "wallet": "apps.subscriptions.wallet_provider.WalletProvider",
}
# Simulateur de paiement : POST /api/v1/payments/<ref>/simulate/ et page /paiement/simulation du site.
# Pas encore de prestataire réel : le simulateur est le moyen de paiement officiel, y compris en production.
# ATTENTION : tant qu'il est actif, n'importe qui peut marquer un paiement comme payé (aucun argent réel).
# Le jour où un prestataire est branché (PAYMENT_PROVIDER_CARD / PAYMENT_PROVIDER_MOMO), mettre False.
PAYMENT_SIMULATION_ENABLED = env.bool("PAYMENT_SIMULATION_ENABLED", default=True)

# Adresse du site, utilisée dans les SMS et e-mails
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

# ---------------------------------------------------------------------------
# Langue et fuseau horaire
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "fr"
LANGUAGES = [("fr", "Français"), ("en", "English")]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "Africa/Abidjan"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Fichiers statiques et téléversés
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Taille maximale de la photo de profil (5 Mo, comme le frontend)
PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
# Durée réelle des vidéos et extraits : mutagen, puis ffprobe s'il est installé (False pour le désactiver)
MEDIA_FFPROBE_ENABLED = env.bool("MEDIA_FFPROBE_ENABLED", default=True)

# ---------------------------------------------------------------------------
# Sécurité (en-têtes valables partout, HTTPS et cookies sécurisés hors DEBUG)
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 8  # session de l'administration : 8 heures
CSRF_COOKIE_SAMESITE = "Lax"
# Le frontend n'utilise pas le jeton CSRF en JavaScript (API en JWT) : cookie inaccessible au script
CSRF_COOKIE_HTTPONLY = True

if not DEBUG:
    # Derrière nginx (qui termine le TLS et transmet X-Forwarded-Proto)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    # /healthz reste accessible en HTTP pour la sonde locale (Docker, superviseur)
    SECURE_REDIRECT_EXEMPT = [r"^healthz$"]
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 365)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
    # À n'activer qu'après inscription volontaire sur https://hstspreload.org (difficile à annuler)
    SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_NAME = "__Secure-agapy_session"
    CSRF_COOKIE_NAME = "__Secure-agapy_csrf"

# ---------------------------------------------------------------------------
# Journalisation : texte lisible en DEBUG ; hors DEBUG, une ligne JSON par événement sur la console
# (récupérée par systemd/journald ou Docker) et, si LOG_FILE est défini, dans un fichier tournant.
# ---------------------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="DEBUG" if DEBUG else "INFO")
LOG_FILE = env("LOG_FILE", default=None)
_log_handlers = ["console"] + (["file"] if LOG_FILE else [])

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "text": {"format": "%(asctime)s %(levelname)s %(name)s : %(message)s"},
        "json": {"()": "config.jsonlog.JsonFormatter"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "text" if DEBUG else "json"},
        **({"file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_FILE,
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 5,
            "encoding": "utf-8",
            "formatter": "json",
        }} if LOG_FILE else {}),
    },
    "root": {"handlers": _log_handlers, "level": "WARNING"},
    "loggers": {
        "agapy": {"handlers": _log_handlers, "level": LOG_LEVEL, "propagate": False},
    },
}
if not DEBUG:
    # Erreurs 5xx, requêtes refusées (Host invalide…) ; en DEBUG, Django garde son affichage habituel
    LOGGING["loggers"]["django"] = {"handlers": _log_handlers, "level": "WARNING", "propagate": False}
