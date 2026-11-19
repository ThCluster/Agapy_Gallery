from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from apps.accounts.models import ArtistStatus
from apps.accounts.views import PublicView

from .models import Category, Post, Report, Topic
from .serializers import (
    CategorySerializer,
    PostSerializer,
    ReportSerializer,
    TopicCreateSerializer,
    TopicDetailSerializer,
    TopicSerializer,
)

# Artistes autorisés à écrire : ni exclus, ni en attente du paiement d'ouverture
WRITER_STATUSES = {ArtistStatus.ACTIVE, ArtistStatus.DORMANT}
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


class ForumPagination(PageNumberPagination):
    page_size = 20


class ForumWriteThrottle(UserRateThrottle):
    """30 sujets ou réponses par heure et par artiste (la lecture n'est pas limitée)."""

    scope = "forum_write"
    rate = "30/hour"

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)


class ForumReportThrottle(AnonRateThrottle):
    """10 signalements par heure et par adresse IP."""

    scope = "forum_report"
    rate = "10/hour"


class IsForumWriter(BasePermission):
    """Lecture libre ; écriture réservée aux artistes connectés et non exclus."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not (user and user.is_authenticated):
            raise NotAuthenticated()
        artist = getattr(user, "artist", None)
        if artist is None or artist.status not in WRITER_STATUSES:
            raise PermissionDenied("Réservé aux artistes.", code="not_an_artist")
        return True


class ForumView:
    """Mixin : pas d'authentification en lecture (un jeton expiré ne bloque pas la lecture)."""

    permission_classes = [IsForumWriter]
    throttle_classes = [ForumWriteThrottle]

    def get_authenticators(self):
        # self.request est encore la requête Django à ce stade
        if self.request.method in SAFE_METHODS:
            return []
        return super().get_authenticators()

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'


def visible_topics():
    return (
        Topic.objects.filter(is_hidden=False, category__is_active=True)
        .select_related("category", "author")
        .annotate(post_count=Count("posts", filter=Q(posts__is_hidden=False)))
    )


@extend_schema(tags=["Forum"])
class CategoryListView(PublicView, generics.ListAPIView):
    """Catégories du forum avec le nombre de sujets."""

    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return Category.objects.filter(is_active=True).annotate(
            topic_count=Count("topics", filter=Q(topics__is_hidden=False))
        )


@extend_schema(tags=["Forum"])
class TopicListView(ForumView, generics.ListCreateAPIView):
    """Sujets (épinglés d'abord, puis par dernier message) ; création réservée aux artistes."""

    serializer_class = TopicSerializer
    pagination_class = ForumPagination

    def get_queryset(self):
        qs = visible_topics()
        params = self.request.query_params
        if category := params.get("category"):
            qs = qs.filter(category__slug=category)
        if q := params.get("q", "").strip():
            qs = qs.filter(Q(title__icontains=q) | Q(body__icontains=q))
        return qs.order_by("-is_pinned", "-last_post_at", "-id")

    @extend_schema(parameters=[
        OpenApiParameter("category", str, description="Identifiant de la catégorie"),
        OpenApiParameter("q", str, description="Recherche dans le titre et le premier message"),
    ])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(request=TopicCreateSerializer, responses={201: TopicDetailSerializer})
    def post(self, request, *args, **kwargs):
        s = TopicCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        now = timezone.now()
        topic = Topic.objects.create(author=request.user.artist, created_at=now, last_post_at=now, **s.validated_data)
        topic = visible_topics().get(pk=topic.pk)
        return Response(TopicDetailSerializer(topic).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Forum"])
class TopicDetailView(PublicView, generics.RetrieveAPIView):
    """Un sujet et son premier message."""

    serializer_class = TopicDetailSerializer

    def get_queryset(self):
        return visible_topics()


@extend_schema(tags=["Forum"])
class TopicPostListView(ForumView, generics.ListCreateAPIView):
    """Réponses d'un sujet (ordre chronologique, sans le premier message) ; réponse réservée aux artistes."""

    serializer_class = PostSerializer
    pagination_class = ForumPagination

    def get_topic(self):
        return get_object_or_404(Topic.objects.filter(is_hidden=False, category__is_active=True), pk=self.kwargs["pk"])

    def get_queryset(self):
        return (Post.objects.filter(topic=self.get_topic(), is_hidden=False)
                .select_related("author").order_by("created_at", "id"))

    def perform_create(self, serializer):
        topic = self.get_topic()
        with transaction.atomic():
            topic = Topic.objects.select_for_update().get(pk=topic.pk)
            if topic.is_locked:
                raise PermissionDenied("Ce sujet est verrouillé.", code="topic_locked")
            now = timezone.now()
            serializer.save(topic=topic, author=self.request.user.artist, created_at=now)
            Topic.objects.filter(pk=topic.pk).update(last_post_at=now)


@extend_schema(tags=["Forum"])
class PostReportView(PublicView):
    """Signaler un message à l'équipe AGAPY (ouvert à tous)."""

    throttle_classes = [ForumReportThrottle]

    @extend_schema(request=ReportSerializer,
                   responses={202: inline_serializer("ForumReportResponse", {"detail": serializers.CharField()})})
    def post(self, request, pk):
        post = get_object_or_404(Post.objects.filter(is_hidden=False, topic__is_hidden=False), pk=pk)
        s = ReportSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        Report.objects.create(post=post, reason=s.validated_data["reason"],
                              ip_address=request.META.get("REMOTE_ADDR") or None)
        return Response({"detail": "Merci, le message a été signalé à l'équipe AGAPY."},
                        status=status.HTTP_202_ACCEPTED)
