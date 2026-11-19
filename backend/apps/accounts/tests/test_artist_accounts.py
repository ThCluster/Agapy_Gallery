"""Contournement des sanctions, inscription assistée, réseaux sociaux, chiffrement des coordonnées."""
from cryptography.fernet import Fernet
from django.contrib.admin.sites import AdminSite
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.test import override_settings

from apps.accounts import fingerprints, services
from apps.accounts.admin import ArtistProfileAdmin, mask_iban, mask_number
from apps.accounts.models import ArtistProfile
from apps.core import fields
from apps.payments.models import PayoutRequest

from .helpers import PASSWORD, BaseTestCase, make_artist
from .test_signup_profile import SIGNUP, VALID_IBAN, signup_data

OTHER_IBAN = "GB82WEST12345698765432"


def raw_value(model, pk, column):
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {column} FROM {model._meta.db_table} WHERE id = %s", [pk])
        return cursor.fetchone()[0]


class SanctionEvasionTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        user = make_artist(phone="+2250700000001", payout_iban=True, iban=VALID_IBAN, account_holder="Awa Koné",
                           momo_number="+2250707070707")
        user.email = "Awa.Kone+art@Exemple.com"
        user.save()
        self.banned = user.artist
        self.banned.save()  # empreinte de l'e-mail recalculée

    def _exclude(self):
        services.exclude_artist(self.banned)

    def assertBanned(self, r):
        self.assertEqual(r.status_code, 400, r.data)
        self.assertEqual(r.data["codes"], {"non_field_errors": ["account_banned"]})
        # Message neutre : rien sur le compte ou la coordonnée reconnue
        self.assertNotIn(self.banned.slug, str(r.data))
        self.assertFalse(ArtistProfile.objects.filter(user__phone="+2250501020304").exists())

    def test_excluded_same_email_refused(self):
        self._exclude()
        self.assertBanned(self.client.post(SIGNUP, signup_data(email="awa.kone@exemple.com"), format="multipart"))

    def test_excluded_same_iban_refused(self):
        self._exclude()
        data = signup_data(payout_iban="true", iban="fr76 3000 6000 0112 3456 7890 189", account_holder="X")
        self.assertBanned(self.client.post(SIGNUP, data, format="multipart"))

    def test_excluded_same_momo_refused(self):
        self._exclude()
        self.assertBanned(self.client.post(SIGNUP, signup_data(momo_number="07 07 07 07 07"), format="multipart"))

    def test_excluded_login_phone_as_momo_refused(self):
        self._exclude()
        self.assertBanned(self.client.post(SIGNUP, signup_data(momo_number="+225 07 00 00 00 01"), format="multipart"))

    def test_excluded_same_phone_refused(self):
        self._exclude()
        r = self.client.post(SIGNUP, signup_data(phone="07 00 00 00 01"), format="multipart")
        self.assertEqual(r.data["codes"], {"non_field_errors": ["account_banned"]})

    def test_unrelated_signup_accepted(self):
        self._exclude()
        r = self.client.post(SIGNUP, signup_data(), format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(ArtistProfile.objects.get(slug="fatou-diallo").flagged_reason, "")

    def test_red_listed_signup_accepted_but_flagged(self):
        services.red_list_artist(self.banned)
        r = self.client.post(SIGNUP, signup_data(email="AWA.KONE@exemple.com"), format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        profile = ArtistProfile.objects.get(slug="fatou-diallo")
        self.assertIn(self.banned.slug, profile.flagged_reason)
        self.assertIn("liste rouge", profile.flagged_reason)
        self.assertNotIn("flagged_reason", str(r.data))

    def test_expired_red_list_not_flagged(self):
        self.banned.red_listed_until = "2000-01-01"
        self.banned.save()
        self.client.post(SIGNUP, signup_data(email="awa.kone@exemple.com"), format="multipart")
        self.assertEqual(ArtistProfile.objects.get(slug="fatou-diallo").flagged_reason, "")

    def test_payout_change_to_banned_iban_flags_account(self):
        self._exclude()
        make_artist(phone="+2250500000009")
        r = self.login(phone="0500000009")
        self.auth(r.data["access"])
        r = self.client.patch("/api/v1/accounts/me/payout/", {"current_password": PASSWORD, "payout_iban": True,
                                                              "iban": VALID_IBAN, "account_holder": "Moi"},
                              format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn("compte exclu", ArtistProfile.objects.get(user__phone="+2250500000009").flagged_reason)

    def test_admin_filter_and_clear_action(self):
        services.red_list_artist(self.banned)
        self.client.post(SIGNUP, signup_data(email="awa.kone@exemple.com"), format="multipart")
        admin = ArtistProfileAdmin(ArtistProfile, AdminSite())
        request = type("R", (), {"GET": {}, "_messages": None})()
        from apps.accounts.admin import FlaggedFilter
        f = FlaggedFilter(request, {"flagged": ["yes"]}, ArtistProfile, admin)
        self.assertEqual([p.slug for p in f.queryset(request, ArtistProfile.objects.all())], ["fatou-diallo"])
        admin.message_user = lambda *a, **k: None
        admin.clear_flag(request, ArtistProfile.objects.all())
        self.assertEqual(ArtistProfile.objects.get(slug="fatou-diallo").flagged_reason, "")

    def test_email_normalization(self):
        self.assertEqual(fingerprints.normalize_email(" J.Doe+x@GoogleMail.com "), "jdoe@gmail.com")
        self.assertEqual(fingerprints.email_fingerprint("a@b.co"), fingerprints.email_fingerprint("A+z@B.co"))


class AssistedSignupAndSocialsTests(BaseTestCase):
    def test_signup_with_assistance_and_socials(self):
        data = signup_data(assisted_by_name="Koffi Yao", assisted_by_phone="07 11 22 33 44",
                           twitter="https://x.com/fatou", tiktok="https://www.tiktok.com/@fatou")
        r = self.client.post(SIGNUP, data, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        p = ArtistProfile.objects.get(slug="fatou-diallo")
        self.assertEqual((p.assisted_by_name, p.assisted_by_phone), ("Koffi Yao", "+2250711223344"))
        self.assertEqual((p.twitter, p.tiktok), ("https://x.com/fatou", "https://www.tiktok.com/@fatou"))

    def test_invalid_assisted_phone_and_url(self):
        r = self.client.post(SIGNUP, signup_data(assisted_by_phone="12", tiktok="pas-une-url"), format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["codes"]["tiktok"], ["invalid"])

    def test_profile_update_socials(self):
        make_artist()
        self.auth(self.login().data["access"])
        r = self.client.patch("/api/v1/accounts/me/", {"twitter": "https://x.com/awa",
                                                               "tiktok": "https://tiktok.com/@awa"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        me = self.client.get("/api/v1/accounts/me/").data
        self.assertEqual(me["artist"]["twitter"], "https://x.com/awa")
        self.assertEqual(me["artist"]["tiktok"], "https://tiktok.com/@awa")
        self.assertIn("assisted_by_name", me["artist"])
        self.assertNotIn("flagged_reason", me["artist"])


class EncryptionTests(BaseTestCase):
    def test_values_encrypted_at_rest(self):
        user = make_artist(payout_iban=True, iban=VALID_IBAN, account_holder="Awa Koné")
        p = user.artist
        for column, clear in (("iban", VALID_IBAN), ("momo_number", "+2250700000000"), ("account_holder", "Awa Koné")):
            raw = raw_value(ArtistProfile, p.pk, column)
            self.assertNotEqual(raw, clear)
            self.assertTrue(raw.startswith(fields.TOKEN_PREFIX))
        p = ArtistProfile.objects.get(pk=p.pk)
        self.assertEqual((p.iban, p.momo_number, p.account_holder), (VALID_IBAN, "+2250700000000", "Awa Koné"))
        self.assertEqual(raw_value(ArtistProfile, make_artist(phone="+2250500000002").artist.pk, "iban"), "")

    def test_payout_destination_encrypted(self):
        p = make_artist().artist
        req = PayoutRequest.objects.create(artist=p, amount=10, currency="XOF", channel="iban",
                                           destination=f"{VALID_IBAN} — Awa")
        self.assertNotIn(VALID_IBAN, raw_value(PayoutRequest, req.pk, "destination"))
        self.assertEqual(PayoutRequest.objects.get(pk=req.pk).destination, f"{VALID_IBAN} — Awa")

    def test_iban_validated_on_clear_value(self):
        r = self.client.post(SIGNUP, signup_data(payout_iban="true", iban="FR7630006000011234567890180",
                                                 account_holder="X"), format="multipart")
        self.assertEqual(r.data["codes"]["iban"], ["iban_invalid"])
        r = self.client.post(SIGNUP, signup_data(payout_iban="true", iban=OTHER_IBAN.lower(), account_holder="X"),
                             format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(ArtistProfile.objects.get(slug="fatou-diallo").iban, OTHER_IBAN)

    def test_api_returns_clear_values(self):
        make_artist(payout_iban=True, iban=VALID_IBAN, account_holder="Awa Koné")
        self.auth(self.login().data["access"])
        artist = self.client.get("/api/v1/accounts/me/").data["artist"]
        self.assertEqual((artist["iban"], artist["account_holder"]), (VALID_IBAN, "Awa Koné"))

    def test_migration_helpers_roundtrip(self):
        p = make_artist(payout_iban=True, iban=VALID_IBAN, account_holder="Awa").artist
        schema_editor = type("S", (), {"connection": connection})()
        from django.apps import apps as registry
        fields.decrypt_existing("accounts", "ArtistProfile", ["iban", "account_holder"])(registry, schema_editor)
        self.assertEqual(raw_value(ArtistProfile, p.pk, "iban"), VALID_IBAN)
        self.assertEqual(ArtistProfile.objects.get(pk=p.pk).iban, VALID_IBAN)  # clair hérité encore lisible
        fields.encrypt_existing("accounts", "ArtistProfile", ["iban", "account_holder"])(registry, schema_editor)
        self.assertTrue(raw_value(ArtistProfile, p.pk, "iban").startswith(fields.TOKEN_PREFIX))
        self.assertEqual(ArtistProfile.objects.get(pk=p.pk).account_holder, "Awa")

    def test_key_configuration(self):
        key = Fernet.generate_key().decode()
        with override_settings(FIELD_ENCRYPTION_KEY=key):
            token = fields.encrypt_str("secret")
            self.assertEqual(Fernet(key.encode()).decrypt(token.encode()), b"secret")
            # Rotation : nouvelle clé en tête, l'ancienne déchiffre encore
            with override_settings(FIELD_ENCRYPTION_KEY=f"{Fernet.generate_key().decode()},{key}"):
                self.assertEqual(fields.decrypt_str(token), "secret")
        with override_settings(FIELD_ENCRYPTION_KEY=None, DEBUG=False):
            original = fields._DEBUG_AT_STARTUP
            fields._DEBUG_AT_STARTUP = False
            try:
                with self.assertRaises(ImproperlyConfigured):
                    fields.encrypt_str("x")
            finally:
                fields._DEBUG_AT_STARTUP = original
        with override_settings(FIELD_ENCRYPTION_KEY="pas-une-cle"):
            with self.assertRaises(ImproperlyConfigured):
                fields.encrypt_str("x")

    def test_admin_masks(self):
        self.assertEqual(mask_iban("FR7630006000011234567890189"), "FR76 •••• •••• 0189")
        self.assertEqual(mask_number("+2250501020304"), "+225 •• •• •• 04")
