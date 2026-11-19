"""
Données existantes :
- chiffre IBAN, numéro mobile money et titulaire du compte (réversible : remis en clair) ;
- calcule les empreintes servant à repérer la réinscription d'un artiste exclu ou sur liste rouge.
"""
from django.db import migrations

import apps.core.fields

ENCRYPTED = ["iban", "momo_number", "account_holder"]


def recompute_fingerprints(apps, schema_editor):
    from apps.accounts import fingerprints

    ArtistProfile = apps.get_model("accounts", "ArtistProfile")
    for profile in ArtistProfile.objects.select_related("user").iterator(chunk_size=500):
        values = fingerprints.compute(email=profile.user.email, iban=profile.iban,
                                      momo_number=profile.momo_number, phone=profile.user.phone)
        ArtistProfile.objects.filter(pk=profile.pk).update(**values)


def clear_fingerprints(apps, schema_editor):
    ArtistProfile = apps.get_model("accounts", "ArtistProfile")
    ArtistProfile.objects.update(email_fingerprint="", iban_fingerprint="", momo_fingerprint="",
                                 phone_fingerprint="")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_artist_sanctions_socials_encryption"),
    ]

    operations = [
        migrations.RunPython(
            apps.core.fields.encrypt_existing("accounts", "ArtistProfile", ENCRYPTED),
            apps.core.fields.decrypt_existing("accounts", "ArtistProfile", ENCRYPTED),
        ),
        migrations.RunPython(recompute_fingerprints, clear_fingerprints),
    ]
