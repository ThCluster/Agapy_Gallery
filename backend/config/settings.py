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
    DATABASES["default"]["CONN_MAX_AGE"] = 60
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
# Cache (compteur d'échecs de connexion, limitation de débit).
# En production avec plusieurs processus : utiliser Redis.
# ---------------------------------------------------------------------------
CACHES = {"default": env.cache("CACHE_URL", default="locmemcache://agapy")}

# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
SMS_BACKEND = env("SMS_BACKEND", default="apps.notifications.sms.ConsoleSmsBackend")
SMS_SENDER_NAME = env("SMS_SENDER_NAME", default="AGAPY")

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

# ---------------------------------------------------------------------------
# Sécurité en production
# ---------------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "agapy": {"handlers": ["console"], "level": "DEBUG" if DEBUG else "INFO"},
    },
}
