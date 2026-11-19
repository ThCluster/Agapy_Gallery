"""Corrections de l'audit de sécurité : verrouillage ciblé, plafonds OTP, jeton de rafraîchissement, admin."""
from datetime import timedelta
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from rest_framework.throttling import SimpleRateThrottle

from apps.accounts import services
from apps.accounts.models import User
from apps.notifications import sms

from .helpers import PASSWORD, BaseTestCase, last_sms_code, make_artist

COOKIE = settings.REFRESH_COOKIE["NAME"]
FORGOT = "/api/v1/auth/password/forgot/"
VERIFY = "/api/v1/auth/password/verify/"
LOGIN = "/api/v1/auth/login/"
PHONE = {"phone_country": "CI", "phone": "07 00 00 00 00"}


class RelaxedRatesMixin:
    """Les limites de débit DRF (lues à l'import, override_settings n'y peut rien) sont relevées ici."""

    def setUp(self):
        super().setUp()
        patcher = mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, {
            "auth_login": "1000/min", "password_otp": "1000/hour", "password_verify": "1000/hour"})
        patcher.start()
        self.addCleanup(patcher.stop)


class TargetedLockoutTests(RelaxedRatesMixin, BaseTestCase):
    def setUp(self):
        super().setUp()
        make_artist()

    def _login(self, ip, password=PASSWORD):
        return self.client.post(LOGIN, {**PHONE, "password": password}, format="json", REMOTE_ADDR=ip)

    def test_lockout_is_per_ip(self):
        for _ in range(settings.LOGIN_MAX_FAILURES):
            self._login("10.0.0.1", "WRONG1234")
        self.assertEqual(self._login("10.0.0.1").status_code, 429)
        # Le vrai titulaire, depuis une autre adresse, se connecte toujours
        self.assertEqual(self._login("10.0.0.2").status_code, 200)

    def test_global_threshold_across_ips(self):
        for i in range(settings.LOGIN_GLOBAL_MAX_FAILURES):
            self._login(f"10.0.1.{i}", "WRONG1234")
        r = self._login("10.0.2.1")
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.data["codes"]["detail"], "login_locked")


@override_settings(PASSWORD_RESET_CODE_COOLDOWN=timedelta(0))
class ResetCodeCapsTests(RelaxedRatesMixin, BaseTestCase):
    def setUp(self):
        super().setUp()
        make_artist()

    def test_codes_per_hour_are_capped(self):
        for _ in range(settings.PASSWORD_RESET_CODES_PER_HOUR + 2):
            r = self.client.post(FORGOT, PHONE, format="json")
            self.assertEqual(r.status_code, 202)  # réponse identique
        self.assertEqual(len(sms.outbox), settings.PASSWORD_RESET_CODES_PER_HOUR)

    def test_codes_per_day_are_capped(self):
        for _ in range(settings.PASSWORD_RESET_CODES_PER_DAY + 2):
            cache.delete("reset-sent-h:+2250700000000")  # simule le passage des heures
            self.client.post(FORGOT, PHONE, format="json")
        self.assertEqual(len(sms.outbox), settings.PASSWORD_RESET_CODES_PER_DAY)

    def test_daily_verify_failures_block_even_a_new_code(self):
        for _ in range(settings.PASSWORD_RESET_VERIFY_MAX_FAILURES_PER_DAY):
            r = self.client.post(VERIFY, {**PHONE, "code": "000000"}, format="json")
            self.assertEqual(r.data["codes"]["code"], ["code_invalid"])
        # Nouveau code : il ne peut plus être vérifié aujourd'hui, même s'il est juste
        self.client.post(FORGOT, PHONE, format="json")
        r = self.client.post(VERIFY, {**PHONE, "code": last_sms_code()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["code"], ["code_invalid"])


class RefreshSecurityTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        make_artist()
        self.client.post(LOGIN, {**PHONE, "password": PASSWORD}, format="json")

    def test_refresh_token_single_use_even_if_not_yet_blacklisted_check(self):
        """Deux requêtes simultanées : la seconde trouve l'entrée de liste noire déjà créée."""
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        from apps.accounts.tokens import AgapyRefreshToken
        raw = self.client.cookies[COOKIE].value
        # Simule la course : la première requête a blacklisté le jeton après la vérification de la seconde
        original_init = AgapyRefreshToken.__init__
        jti = AgapyRefreshToken(raw)["jti"]

        def init_then_race(this, *a, **kw):
            original_init(this, *a, **kw)
            BlacklistedToken.objects.get_or_create(token=OutstandingToken.objects.get(jti=jti))

        AgapyRefreshToken.__init__ = init_then_race
        try:
            r = self.client.post("/api/v1/auth/refresh/")
        finally:
            AgapyRefreshToken.__init__ = original_init
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data["codes"]["detail"], "session_expired")

    def test_foreign_origin_is_refused(self):
        r = self.client.post("/api/v1/auth/refresh/", HTTP_ORIGIN="https://evil.example")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["codes"]["detail"], "origin_forbidden")
        self.assertIn(COOKIE, self.client.cookies)  # la session n'est pas détruite pour autant
        self.assertEqual(self.client.post("/api/v1/auth/logout/", HTTP_ORIGIN="https://evil.example").status_code, 403)

    @override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:5173"])
    def test_allowed_origins(self):
        r = self.client.post("/api/v1/auth/refresh/", HTTP_ORIGIN="http://localhost:5173")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/v1/auth/refresh/", HTTP_ORIGIN="http://testserver")
        self.assertEqual(r.status_code, 200)


class AdminLoginThrottleTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        User.objects.create_superuser(phone="+2250100000000", password=PASSWORD)
        from django.urls import reverse
        self.url = reverse("admin:login")

    def _post(self, password, ip="10.9.9.9", username="+2250100000000"):
        return self.client.post(self.url, {"username": username, "password": password}, REMOTE_ADDR=ip)

    def test_admin_login_locked_after_failures(self):
        for _ in range(settings.ADMIN_LOGIN_MAX_FAILURES):
            self.assertEqual(self._post("WRONG1234").status_code, 200)
        self.assertEqual(self._post(PASSWORD).status_code, 429)
        # Même identifiant depuis une autre adresse : bloqué aussi (compteur par identifiant)
        self.assertEqual(self._post(PASSWORD, ip="10.9.9.10").status_code, 429)

    def test_admin_login_success(self):
        self.assertEqual(self._post(PASSWORD).status_code, 302)


class LoginServiceTests(BaseTestCase):
    def test_password_reset_clears_all_ip_lockouts(self):
        phone = "+2250700000000"
        for _ in range(settings.LOGIN_MAX_FAILURES):
            services.record_login_failure(phone, "10.0.0.1")
        self.assertTrue(services.is_login_locked(phone, "10.0.0.1"))
        services.reset_all_login_failures(phone)
        self.assertFalse(services.is_login_locked(phone, "10.0.0.1"))
