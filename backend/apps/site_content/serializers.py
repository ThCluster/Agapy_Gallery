from rest_framework import serializers

from .models import ContactMessage, Language, Partner


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "email", "phone", "subject", "message"]


class NewsletterSubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    language = serializers.ChoiceField(choices=Language.choices, default=Language.FR)


class NewsletterUnsubscribeSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=500)


class PartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partner
        fields = ["id", "name", "logo", "url"]


class PageSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    lang = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    updated_at = serializers.DateTimeField()


class StatsSerializer(serializers.Serializer):
    artist_count = serializers.IntegerField()
