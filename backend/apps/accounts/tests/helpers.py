import io
import re

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from apps.accounts.models import ArtistProfile, ArtistStatus, Civility, User
from apps.notifications import sms

PASSWORD = "ARTS2026"
PHONE = "+2250700000000"


def image_file(name="photo.png", size=(10, 10)):
    buf = io.BytesIO()
    Image.new("RGB", size, "green").save(buf, "PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def make_artist(phone=PHONE, password=PASSWORD, status=ArtistStatus.ACTIVE, **profile):
    user = User.objects.create_user(phone=phone, password=password, email="awa@exemple.com",
                                    is_active=status != ArtistStatus.PENDING_PAYMENT)
    defaults = dict(civility=Civility.MRS, last_name="Koné", first_names="Awa", artist_name="Awa Koné",
                    country="CI", city="Abidjan", status=status, payout_momo=True,
                    momo_operator="Orange Money", momo_number=phone)
    defaults.update(profile)
    ArtistProfile.objects.create(user=user, **defaults)
    return user


def last_sms_code() -> str:
    return re.search(r"\b(\d{6})\b", sms.outbox[-1]["message"]).group(1)


@override_settings(
    SMS_BACKEND="apps.notifications.sms.LocmemSmsBackend",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    # Hachage rapide pour les tests uniquement
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class BaseTestCase(APITestCase):
    def setUp(self):
        cache.clear()  # compteurs d'échecs et limites de débit
        sms.outbox.clear()

    def login(self, phone="07 00 00 00 00", password=PASSWORD, remember=False, country="CI"):
        return self.client.post("/api/v1/auth/login/", {"phone_country": country, "phone": phone,
                                                         "password": password, "remember": remember}, format="json")

    def auth(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
