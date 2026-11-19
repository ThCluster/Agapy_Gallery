"""
Contrôle des fichiers téléversés (photos, images d'œuvres, extraits, clips).

- Images : extension ET format réel (Pillow) limités à JPEG, PNG et WebP, taille en pixels
  bornée (protection contre les « bombes de décompression »), puis ré-encodage : les métadonnées
  (EXIF, GPS…) sont supprimées et l'extension du fichier enregistré suit le format réel.
- Audio / vidéo : on vérifie les octets de signature du fichier, pas seulement son extension.

Codes d'erreur stables : file_type, file_too_large, image_too_large.
"""
import io
import os
import warnings

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import models
from django.utils.deconstruct import deconstructible
from PIL import Image, ImageOps, UnidentifiedImageError

# Au-delà, Pillow lève une erreur (bombe de décompression) au lieu de tout charger en mémoire
Image.MAX_IMAGE_PIXELS = 40_000_000
MAX_IMAGE_SIDE = 10_000

IMAGE_EXTENSIONS = ("jpg", "jpeg", "png", "webp")
# Format Pillow → extension enregistrée
IMAGE_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
IMAGE_TYPES_LABEL = "JPEG, PNG ou WebP"


def _ext(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if name and "." in name else ""


def _mb(n: int) -> str:
    return f"{n / (1024 * 1024):g} Mo"


def _is_stored(f) -> bool:
    """Fichier déjà enregistré (FieldFile inchangé dans un formulaire) : rien à revérifier."""
    return getattr(f, "_committed", False) is True


def _open_image(f) -> Image.Image:
    """Ouvre (une copie de) l'image en traitant l'avertissement « bombe de décompression » comme une erreur."""
    f.seek(0)
    data = io.BytesIO(f.read())  # copie : Pillow peut fermer le fichier qu'on lui donne
    f.seek(0)
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            img = Image.open(data)
            img.size  # noqa: B018  (lecture de l'en-tête)
        except (Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ValidationError("L'image est trop grande (nombre de pixels).", code="image_too_large")
        except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
            raise ValidationError(f"Le fichier n'est pas une image {IMAGE_TYPES_LABEL} valide.", code="file_type")
    return img


@deconstructible
class ImageValidator:
    """Image JPEG / PNG / WebP (extension et contenu), poids et dimensions bornés."""

    def __init__(self, max_bytes: int | None = None):
        self.max_bytes = max_bytes

    def __call__(self, f):
        if not f or _is_stored(f):
            return
        if _ext(getattr(f, "name", "")) not in IMAGE_EXTENSIONS:
            raise ValidationError(f"Formats d'image acceptés : {IMAGE_TYPES_LABEL}.", code="file_type")
        if self.max_bytes and f.size > self.max_bytes:
            raise ValidationError(f"L'image ne doit pas dépasser {_mb(self.max_bytes)}.", code="file_too_large")
        img = _open_image(f)
        try:
            if img.format not in IMAGE_FORMATS:
                raise ValidationError(f"Formats d'image acceptés : {IMAGE_TYPES_LABEL}.", code="file_type")
            width, height = img.size
            if width > MAX_IMAGE_SIDE or height > MAX_IMAGE_SIDE:
                raise ValidationError(f"L'image ne doit pas dépasser {MAX_IMAGE_SIDE} pixels de côté.",
                                      code="image_too_large")
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                try:
                    img.load()  # image tronquée ou corrompue
                except (Image.DecompressionBombError, Image.DecompressionBombWarning):
                    raise ValidationError("L'image est trop grande (nombre de pixels).", code="image_too_large")
                except (OSError, ValueError, SyntaxError):
                    raise ValidationError(f"Le fichier n'est pas une image {IMAGE_TYPES_LABEL} valide.",
                                          code="file_type")
        finally:
            img.close()
            f.seek(0)

    def __eq__(self, other):
        return isinstance(other, ImageValidator) and other.max_bytes == self.max_bytes


validate_image = ImageValidator()


def sanitize_image(f, name: str) -> tuple[ContentFile, str]:
    """
    Ré-encode l'image (orientation EXIF appliquée, métadonnées supprimées).
    Renvoie (contenu, nom) ; l'extension du nom suit le format réel.
    Un format non autorisé (qui aurait échappé à la validation) est converti en PNG.
    """
    img = _open_image(f)
    try:
        fmt = img.format if img.format in IMAGE_FORMATS else "PNG"
        img = ImageOps.exif_transpose(img)
        if fmt == "JPEG":
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            options = {"quality": 90, "optimize": True}
        else:
            if img.mode not in ("RGB", "RGBA", "L", "LA"):
                img = img.convert("RGBA")
            options = {"quality": 90} if fmt == "WEBP" else {"optimize": True}
        buf = io.BytesIO()
        img.save(buf, fmt, **options)  # sans exif= ni pnginfo= : aucune métadonnée recopiée
    finally:
        img.close()
        f.seek(0)
    stem = os.path.splitext(os.path.basename(name or ""))[0] or "image"
    new_name = f"{stem}.{IMAGE_FORMATS[fmt]}"
    return ContentFile(buf.getvalue(), name=new_name), new_name


class SafeImageField(models.ImageField):
    """
    ImageField qui valide l'image (voir ImageValidator) et la ré-encode à l'enregistrement.
    Se déclare comme un ImageField ordinaire dans les migrations.
    """

    def __init__(self, *args, max_bytes: int | None = None, **kwargs):
        self.max_bytes = max_bytes
        super().__init__(*args, **kwargs)
        self.default_validators = [ImageValidator(max_bytes)]

    def deconstruct(self):
        name, _path, args, kwargs = super().deconstruct()
        return name, "django.db.models.ImageField", args, kwargs

    def pre_save(self, model_instance, add):
        file = getattr(model_instance, self.attname)
        if file and not file._committed:
            content, name = sanitize_image(file.file, file.name)
            file.save(name, content, save=False)
        return file


# ---------------------------------------------------------------------------
# Audio et vidéo : octets de signature
# ---------------------------------------------------------------------------
def _is_ftyp(h: bytes) -> bool:  # MP4, M4A, MOV (ISO BMFF)
    return h[4:8] == b"ftyp"


def _is_webm(h: bytes) -> bool:  # EBML (WebM, Matroska)
    return h[:4] == b"\x1a\x45\xdf\xa3"


def _is_mpeg_audio(h: bytes) -> bool:  # MP3 (ID3 ou trame MPEG), AAC (ADTS)
    return h[:3] == b"ID3" or (len(h) > 1 and h[0] == 0xFF and (h[1] & 0xE0) == 0xE0)


def _is_ogg(h: bytes) -> bool:
    return h[:4] == b"OggS"


def _is_wav(h: bytes) -> bool:
    return h[:4] == b"RIFF" and h[8:12] == b"WAVE"


SIGNATURES = {
    "mp4": (_is_ftyp,), "m4a": (_is_ftyp,), "mov": (_is_ftyp,),
    "webm": (_is_webm,),
    "mp3": (_is_mpeg_audio,), "aac": (_is_mpeg_audio, _is_ftyp),
    "ogg": (_is_ogg,),
    "wav": (_is_wav,),
}


@deconstructible
class MediaValidator:
    """Fichier audio / vidéo : extension autorisée, contenu conforme à l'extension, poids borné."""

    def __init__(self, extensions, max_bytes: int | None = None, label: str = "Le fichier"):
        self.extensions = tuple(extensions)
        self.max_bytes = max_bytes
        self.label = label

    def __call__(self, f):
        if not f or _is_stored(f):
            return
        ext = _ext(getattr(f, "name", ""))
        accepted = ", ".join(e.upper() for e in self.extensions)
        if ext not in self.extensions or ext not in SIGNATURES:
            raise ValidationError(f"Formats acceptés : {accepted}.", code="file_type")
        if self.max_bytes and f.size > self.max_bytes:
            raise ValidationError(f"{self.label} ne doit pas dépasser {_mb(self.max_bytes)}.", code="file_too_large")
        f.seek(0)
        head = f.read(16)
        f.seek(0)
        if not any(check(head) for check in SIGNATURES[ext]):
            raise ValidationError(f"Le contenu du fichier ne correspond pas au format {ext.upper()}.",
                                  code="file_type")

    def __eq__(self, other):
        return (isinstance(other, MediaValidator) and other.extensions == self.extensions
                and other.max_bytes == self.max_bytes)
