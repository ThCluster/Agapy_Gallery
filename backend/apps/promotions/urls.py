"""/api/v1/promotions/"""
from django.urls import path

from . import views

urlpatterns = [
    path("clips/", views.ClipCreateView.as_view(), name="clip-create"),
    path("clips/live/", views.LiveClipsView.as_view(), name="clip-live"),
    path("ads/", views.AdsView.as_view(), name="ads"),
    path("live-tv/", views.LiveTvView.as_view(), name="live-tv"),
]
