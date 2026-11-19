from django.core import mail

from apps.accounts import services
from apps.accounts.models import ArtistProfile, ArtistStatus, User
from apps.accounts.validators import validate_iban
from apps.notifications import sms

from .helpers import BaseTestCase, image_file, make_artist

SIGNUP = "/api/v1/accounts/signup/"
VALID_IBAN = "FR7630006000011234567890189"


def signup_data(**overrides):
    data = {
        "civility": "mrs", "last_name": "Diallo", "first_names": "Fatou", "birth_date": "1990-04-12",
        "birth_place": "Bouaké", "artist_name": "Fatou Diallo",
        "phone_country": "CI", "phone": "05 01 02 03 04", "email": "fatou@exemple.com",
        "country": "CI", "city": "Abidjan", "gps": "5.3364, -4.0267", "photo": image_file(),
        "payout_momo": "true", "momo_operator": "Wave", "momo_number": "05 01 02 03 04",
        "accept_terms": "true",
    }
    data.update(overrides)
    return data


class SignupTests(BaseTestCase):
    def test_signup_creates_pending_account(self):
        r = self.client.post(SIGNUP, signup_data(), format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data, {"id": "fatou-diallo", "login": "+225 05 01 02 0304",
                                  "status": "pending_payment", "region": "africa"})
        user = User.objects.get(phone="+2250501020304")
        self.assertFalse(user.is_active)
        self.assertFalse(user.has_usable_password())
        self.assertEqual(user.artist.momo_number, "+2250501020304")

    def test_activation_sends_credentials(self):
        self.client.post(SIGNUP, signup_data(), format="multipart")
        profile = ArtistProfile.objects.get(slug="fatou-diallo")
        with self.captureOnCommitCallbacks(execute=True):
            services.activate_account(profile)
        self.assertEqual(sms.outbox[-1]["to"], "+2250501020304")
        password = sms.outbox[-1]["message"].split("Mot de passe : ")[1].split()[0]
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.login(phone="0501020304", password=password).status_code, 200)

    def test_org_signup(self):
        data = signup_data(civility="org", org_name="Fondation Lumière", founded_date="2010-01-01",
                           founded_place="Dakar", country="SN", last_name="", first_names="",
                           birth_date="", birth_place="", artist_name="")
        r = self.client.post(SIGNUP, data, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["id"], "fondation-lumiere")

    def test_required_fields_and_codes(self):
        data = signup_data(artist_name="", birth_date="2999-01-01", payout_momo="false", accept_terms="false")
        r = self.client.post(SIGNUP, data, format="multipart")
        self.assertEqual(r.status_code, 400)
        codes = r.data["codes"]
        self.assertEqual(codes["artist_name"], ["required"])
        self.assertEqual(codes["birth_date"], ["future_date"])
        self.assertEqual(codes["payout_momo"], ["payout_required"])
        self.assertEqual(codes["accept_terms"], ["terms_required"])

    def test_invalid_iban(self):
        r = self.client.post(SIGNUP, signup_data(payout_iban="true", account_holder="F. Diallo",
                                                 iban="FR7630006000011234567890180"), format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["iban"], ["iban_invalid"])

    def test_phone_taken_by_active_account(self):
        make_artist(phone="+2250501020304")
        r = self.client.post(SIGNUP, signup_data(), format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["phone"], ["phone_taken"])

    def test_unpaid_signup_can_be_restarted(self):
        self.client.post(SIGNUP, signup_data(), format="multipart")
        r = self.client.post(SIGNUP, signup_data(artist_name="Fatou D.", photo=image_file()), format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(User.objects.filter(phone="+2250501020304").count(), 1)
        self.assertEqual(ArtistProfile.objects.get().artist_name, "Fatou D.")

    def test_photo_must_be_an_image(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        bad = SimpleUploadedFile("x.png", b"pas une image", content_type="image/png")
        r = self.client.post(SIGNUP, signup_data(photo=bad), format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("photo", r.data)

    def test_slug_is_unique(self):
        make_artist(phone="+2250700000000", artist_name="Fatou Diallo")
        r = self.client.post(SIGNUP, signup_data(), format="multipart")
        self.assertEqual(r.data["id"], "fatou-diallo-2")


class ProfileTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_artist()
        self.auth(self.login().data["access"])

    def test_update_public_info(self):
        r = self.client.patch("/api/v1/accounts/me/", {"bio": "Peintre de la lagune.", "email": "new@exemple.com",
                                                       "instagram": "https://instagram.com/awa"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["email"], "new@exemple.com")
        self.assertEqual(r.data["artist"]["bio"], "Peintre de la lagune.")

    def test_artist_name_cannot_be_emptied(self):
        r = self.client.patch("/api/v1/accounts/me/", {"artist_name": " "}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_update_payout(self):
        r = self.client.patch("/api/v1/accounts/me/payout/", {"payout_iban": True, "account_holder": "Awa Koné",
                                                              "iban": "fr76 3000 6000 0112 3456 7890 189"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["artist"]["iban"], VALID_IBAN)

    def test_payout_needs_one_method(self):
        r = self.client.patch("/api/v1/accounts/me/payout/", {"payout_momo": False}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["payout_momo"], ["payout_required"])

    def test_staff_without_artist_profile(self):
        User.objects.create_user(phone="+2250101010101", password="Admin2026", is_staff=True)
        self.client.credentials()
        self.auth(self.login(phone="0101010101", password="Admin2026").data["access"])
        self.assertIsNone(self.client.get("/api/v1/accounts/me/").data["artist"])
        self.assertEqual(self.client.patch("/api/v1/accounts/me/", {"bio": "x"}, format="json").status_code, 403)


class ValidatorTests(BaseTestCase):
    def test_iban_checksum(self):
        validate_iban(VALID_IBAN)
        validate_iban("CI93 CI00 8011 1301 1342 9120 0589")  # IBAN ivoirien

    def test_status_default(self):
        self.assertEqual(ArtistProfile._meta.get_field("status").default, ArtistStatus.PENDING_PAYMENT)


class SpecAdjustmentTests(BaseTestCase):
    """Ajustements issus du cahier des charges (p. 10, 15, 17)."""

    def test_generated_password_is_uppercase_and_digits(self):
        for _ in range(50):
            pwd = services.generate_password()
            self.assertRegex(pwd, r"^[A-Z2-9]{10}$")
            self.assertTrue(any(c.isdigit() for c in pwd) and any(c.isalpha() for c in pwd))
            self.assertFalse(set(pwd) & set("0O1I"))

    def test_identity_is_editable(self):
        make_artist()
        self.auth(self.login().data["access"])
        r = self.client.patch("/api/v1/accounts/me/", {"last_name": "Koné-Traoré", "birth_place": "Korhogo",
                                                       "country": "sn"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["artist"]["last_name"], "Koné-Traoré")
        self.assertEqual(r.data["artist"]["country"], "SN")
        # Le numéro de connexion ne change pas par cette voie
        self.client.patch("/api/v1/accounts/me/", {"phone": "+2250500000000"}, format="json")
        self.assertEqual(self.client.get("/api/v1/accounts/me/").data["phone"], "+2250700000000")

    def test_identity_cannot_be_emptied_or_in_future(self):
        make_artist()
        self.auth(self.login().data["access"])
        r = self.client.patch("/api/v1/accounts/me/", {"last_name": "", "birth_date": "2999-01-01"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["birth_date"], ["future_date"])
