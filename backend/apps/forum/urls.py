"""/api/v1/forum/"""
from django.urls import path

from . import views

urlpatterns = [
    path("categories/", views.CategoryListView.as_view(), name="forum-categories"),
    path("topics/", views.TopicListView.as_view(), name="forum-topics"),
    path("topics/<int:pk>/", views.TopicDetailView.as_view(), name="forum-topic"),
    path("topics/<int:pk>/posts/", views.TopicPostListView.as_view(), name="forum-topic-posts"),
    path("posts/<int:pk>/report/", views.PostReportView.as_view(), name="forum-post-report"),
]
