from django.conf import settings

from apps.accounts.models import ArtistStatus

from .helpers import PASSWORD, BaseTestCase, make_artist

COOKIE = settings.REFRESH_COOKIE["NAME"]


class LoginTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()

    def test_login_with_local_number(self):
        r = self.login()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn("access", r.data)
        self.assertEqual(r.data["user"]["phone"], "+2250700000000")
        self.assertEqual(r.data["user"]["artist"]["id"], "awa-kone")
        cookie = r.cookies[COOKIE]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], "/api/v1/auth/")
        self.assertEqual(cookie["max-age"], "")  # sans « Se souvenir de moi » : cookie de session

    def test_login_with_international_number_and_remember(self):
        r = self.login(phone="+225 07 00 00 00 00", remember=True, country="FR")
        self.assertEqual(r.status_code, 200)
        self.assertGreater(int(r.cookies[COOKIE]["max-age"]), 29 * 24 * 3600)

    def test_wrong_password(self):
        r = self.login(password="WRONG1234")
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data["codes"]["detail"], "invalid_credentials")

    def test_invalid_phone(self):
        r = self.login(phone="123")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["phone"], ["phone_invalid"])

    def test_pending_account_cannot_login(self):
        make_artist(phone="+2250500000000", status=ArtistStatus.PENDING_PAYMENT)
        self.assertEqual(self.login(phone="0500000000").status_code, 401)

    def test_lockout_after_repeated_failures(self):
        for _ in range(settings.LOGIN_MAX_FAILURES):
            self.login(password="WRONG1234")
        r = self.login()  # même le bon mot de passe est refusé pendant le blocage
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.data["codes"]["detail"], "login_locked")


class SessionTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()

    def test_me_requires_token(self):
        self.assertEqual(self.client.get("/api/v1/accounts/me/").status_code, 401)

    def test_me_with_token(self):
        self.auth(self.login().data["access"])
        r = self.client.get("/api/v1/accounts/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["artist"]["display_name"], "Awa Koné")
        self.assertEqual(r.data["artist"]["region"], "africa")

    def test_refresh_rotates_and_old_cookie_is_rejected(self):
        self.login()
        old = self.client.cookies[COOKIE].value
        r = self.client.post("/api/v1/auth/refresh/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        self.assertNotEqual(self.client.cookies[COOKIE].value, old)

        self.client.cookies[COOKIE] = old  # rejouer l'ancien jeton
        r = self.client.post("/api/v1/auth/refresh/")
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data["codes"]["detail"], "session_expired")

    def test_refresh_without_cookie(self):
        self.assertEqual(self.client.post("/api/v1/auth/refresh/").status_code, 401)

    def test_logout_revokes_refresh(self):
        self.login()
        token = self.client.cookies[COOKIE].value
        self.assertEqual(self.client.post("/api/v1/auth/logout/").status_code, 204)
        self.client.cookies[COOKIE] = token
        self.assertEqual(self.client.post("/api/v1/auth/refresh/").status_code, 401)

    def test_deactivated_user_token_rejected(self):
        self.auth(self.login().data["access"])
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.client.get("/api/v1/accounts/me/").status_code, 401)


class PasswordChangeTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()

    def test_change_password_revokes_other_sessions(self):
        other_access = self.login().data["access"]
        other_refresh = self.client.cookies[COOKIE].value
        self.auth(self.login().data["access"])

        r = self.client.post("/api/v1/auth/password/change/",
                             {"current_password": PASSWORD, "new_password": "Nouveau2026"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        new_access = r.data["access"]

        # L'ancien jeton d'accès et l'ancien cookie ne marchent plus
        self.auth(other_access)
        self.assertEqual(self.client.get("/api/v1/accounts/me/").status_code, 401)
        new_refresh = self.client.cookies[COOKIE].value
        self.client.cookies[COOKIE] = other_refresh
        self.assertEqual(self.client.post("/api/v1/auth/refresh/").status_code, 401)

        # La session qui a changé le mot de passe continue
        self.auth(new_access)
        self.assertEqual(self.client.get("/api/v1/accounts/me/").status_code, 200)
        self.client.cookies[COOKIE] = new_refresh
        self.assertEqual(self.client.post("/api/v1/auth/refresh/").status_code, 200)

        self.client.credentials()
        self.assertEqual(self.login(password="Nouveau2026").status_code, 200)

    def test_wrong_current_password(self):
        self.auth(self.login().data["access"])
        r = self.client.post("/api/v1/auth/password/change/",
                             {"current_password": "Mauvais123", "new_password": "Nouveau2026"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["current_password"], ["password_incorrect"])

    def test_new_password_must_follow_rule(self):
        self.auth(self.login().data["access"])
        for bad in ["court1", "seulementlettres", "123456789", "Trop1Long12345", "avec espace1"]:
            r = self.client.post("/api/v1/auth/password/change/",
                                 {"current_password": PASSWORD, "new_password": bad}, format="json")
            self.assertEqual(r.status_code, 400, bad)
            self.assertIn("password_format", r.data["codes"]["new_password"], bad)
