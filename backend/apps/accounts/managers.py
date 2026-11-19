from django.contrib.auth.base_user import BaseUserManager

from apps.core.phone import normalize_phone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone, password, **extra):
        if not phone:
            raise ValueError("Le numéro de téléphone est obligatoire.")
        # Sans indicatif, le numéro est lu comme ivoirien
        phone = normalize_phone(phone, "CI")
        email = self.normalize_email(extra.pop("email", ""))
        user = self.model(phone=phone, email=email, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(phone, password, **extra)

    def create_superuser(self, phone, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active", True)
        if not extra["is_staff"] or not extra["is_superuser"]:
            raise ValueError("Un superutilisateur doit avoir is_staff et is_superuser.")
        return self._create_user(phone, password, **extra)

    def get_by_natural_key(self, phone):
        # Accepte « 0700000000 » comme « +2250700000000 » dans l'administration
        try:
            phone = normalize_phone(phone, "CI")
        except Exception:
            pass
        return self.get(**{self.model.USERNAME_FIELD: phone})
