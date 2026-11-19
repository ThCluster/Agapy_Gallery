from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.accounts.models import PasswordResetCode
from apps.notifications import sms

from .helpers import BaseTestCase, last_sms_code, make_artist

FORGOT = "/api/v1/auth/password/forgot/"
VERIFY = "/api/v1/auth/password/verify/"
RESET = "/api/v1/auth/password/reset/"


class PasswordResetTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.phone = {"phone_country": "CI", "phone": "07 00 00 00 00"}

    def _code(self):
        self.client.post(FORGOT, self.phone, format="json")
        return last_sms_code()

    def test_full_flow(self):
        r = self.client.post(FORGOT, self.phone, format="json")
        self.assertEqual(r.status_code, 202)
        self.assertEqual(sms.outbox[-1]["to"], "+2250700000000")

        r = self.client.post(VERIFY, {**self.phone, "code": last_sms_code()}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        token = r.data["reset_token"]

        r = self.client.post(RESET, {"reset_token": token, "password": "Nouveau2026"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self.login(password="Nouveau2026").status_code, 200)

        # Le jeton est à usage unique
        r = self.client.post(RESET, {"reset_token": token, "password": "Encore2026"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["reset_token"], ["reset_token_invalid"])

    def test_unknown_number_gives_same_answer_without_sms(self):
        r = self.client.post(FORGOT, {"phone_country": "CI", "phone": "0102030405"}, format="json")
        self.assertEqual(r.status_code, 202)
        self.assertEqual(sms.outbox, [])

    def test_wrong_code_then_lock_after_max_attempts(self):
        code = self._code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(settings.PASSWORD_RESET_CODE_MAX_ATTEMPTS):
            r = self.client.post(VERIFY, {**self.phone, "code": wrong}, format="json")
            self.assertEqual(r.status_code, 400)
        # Même le bon code ne marche plus
        r = self.client.post(VERIFY, {**self.phone, "code": code}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["code"], ["code_invalid"])

    def test_expired_code(self):
        code = self._code()
        PasswordResetCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        r = self.client.post(VERIFY, {**self.phone, "code": code}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_cooldown_between_sms(self):
        self._code()
        self.client.post(FORGOT, self.phone, format="json")
        self.assertEqual(len(sms.outbox), 1)

    def test_new_code_invalidates_previous(self):
        first = self._code()
        PasswordResetCode.objects.update(created_at=timezone.now() - timedelta(minutes=5))
        second = self._code()
        self.assertEqual(len(sms.outbox), 2)
        if first != second:
            self.assertEqual(self.client.post(VERIFY, {**self.phone, "code": first}, format="json").status_code, 400)
        self.assertEqual(self.client.post(VERIFY, {**self.phone, "code": second}, format="json").status_code, 200)

    def test_reset_rejects_weak_password(self):
        token = self.client.post(VERIFY, {**self.phone, "code": self._code()}, format="json").data["reset_token"]
        r = self.client.post(RESET, {"reset_token": token, "password": "faible"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_reset_logs_out_everywhere(self):
        access = self.login().data["access"]
        token = self.client.post(VERIFY, {**self.phone, "code": self._code()}, format="json").data["reset_token"]
        self.client.post(RESET, {"reset_token": token, "password": "Nouveau2026"}, format="json")
        self.auth(access)
        self.assertEqual(self.client.get("/api/v1/accounts/me/").status_code, 401)
