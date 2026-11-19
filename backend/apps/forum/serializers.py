from rest_framework import serializers

from .models import BODY_MAX, BODY_MIN, TITLE_MAX, TITLE_MIN, Category, Post, Topic


class AuthorSerializer(serializers.Serializer):
    name = serializers.CharField(source="display_name")
    artist_id = serializers.CharField(source="slug")


class CategorySerializer(serializers.ModelSerializer):
    topic_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "description", "topic_count"]


class CategoryRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["slug", "name"]


def _body_field():
    return serializers.CharField(min_length=BODY_MIN, max_length=BODY_MAX, trim_whitespace=True)


class TopicSerializer(serializers.ModelSerializer):
    category = CategoryRefSerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    post_count = serializers.IntegerField(read_only=True,
                                          help_text="Nombre de réponses visibles (sans le premier message).")

    class Meta:
        model = Topic
        fields = ["id", "title", "category", "author", "created_at", "last_post_at", "post_count",
                  "is_pinned", "is_locked"]


class TopicDetailSerializer(TopicSerializer):
    class Meta(TopicSerializer.Meta):
        fields = TopicSerializer.Meta.fields + ["body"]


class TopicCreateSerializer(serializers.Serializer):
    category = serializers.SlugRelatedField(slug_field="slug", queryset=Category.objects.filter(is_active=True))
    title = serializers.CharField(min_length=TITLE_MIN, max_length=TITLE_MAX, trim_whitespace=True)
    body = _body_field()


class PostSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)
    body = _body_field()

    class Meta:
        model = Post
        fields = ["id", "author", "body", "created_at"]
        read_only_fields = ["id", "created_at"]


class ReportSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=3, max_length=500, trim_whitespace=True)
