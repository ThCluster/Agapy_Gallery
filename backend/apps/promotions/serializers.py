from django.conf import settings
from rest_framework import serializers


from apps.core.pricing import CLIP_MAX_SECONDS
from apps.core.uploads import ImageValidator, MediaValidator

from . import services
from .models import AdCampaign, Clip, LiveStream

CLIP_VIDEO_EXTENSIONS = ("mp4", "webm")
CLIP_VIDEO_MAX_BYTES = getattr(settings, "CLIP_VIDEO_MAX_BYTES", 50 * 1024 * 1024)
CLIP_POSTER_MAX_BYTES = getattr(settings, "PROFILE_PHOTO_MAX_BYTES", 5 * 1024 * 1024)


class ClipCreateSerializer(serializers.ModelSerializer):
    method = serializers.ChoiceField(choices=["card", "momo", "wallet"], write_only=True)

    class Meta:
        model = Clip
        fields = ["title", "advertiser", "contact_phone", "contact_email", "video", "poster", "duration_seconds",
                  "method"]

    def validate_video(self, video):
        ext = video.name.rsplit(".", 1)[-1].lower() if "." in video.name else ""
        if ext not in CLIP_VIDEO_EXTENSIONS:
            raise serializers.ValidationError("La vidéo doit être au format MP4 ou WebM.", code="video_format")
        # Poids et octets de signature (MP4 : « ftyp » ; WebM : 1A 45 DF A3) : file_too_large, file_type
        MediaValidator(CLIP_VIDEO_EXTENSIONS, CLIP_VIDEO_MAX_BYTES, label="La vidéo")(video)
        return video

    def validate_poster(self, poster):
        # JPEG / PNG / WebP réels : file_type, file_too_large, image_too_large (ré-encodée à l'enregistrement)
        if poster:
            ImageValidator(CLIP_POSTER_MAX_BYTES)(poster)
        return poster

    def validate_duration_seconds(self, value):
        if value < 1:
            raise serializers.ValidationError("Indiquez la durée du clip.", code="invalid")
        if value > CLIP_MAX_SECONDS:
            raise serializers.ValidationError(f"Le clip ne doit pas dépasser {CLIP_MAX_SECONDS} secondes.",
                                              code="video_too_long")
        return value

    def validate(self, d):
        if not d.get("contact_phone") and not d.get("contact_email"):
            raise serializers.ValidationError(
                {"contact_phone": serializers.ErrorDetail("Indiquez un téléphone ou un e-mail de contact.",
                                                          code="contact_required")})
        return d


class ClipSerializer(serializers.ModelSerializer):
    queue_position = serializers.SerializerMethodField()

    class Meta:
        model = Clip
        fields = ["id", "title", "advertiser", "video", "poster", "duration_seconds", "status", "paid_at",
                  "starts_at", "ends_at", "queue_position"]

    def get_queue_position(self, clip) -> int | None:
        return services.queue_position(clip)


class LiveClipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clip
        fields = ["id", "title", "advertiser", "video", "poster", "duration_seconds", "starts_at", "ends_at"]



class AdCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdCampaign
        fields = ["id", "advertiser", "format", "image", "link_url", "alt_text"]


class LiveStreamSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiveStream
        fields = ["id", "title", "description", "embed_url", "starts_at", "ends_at", "is_live"]
