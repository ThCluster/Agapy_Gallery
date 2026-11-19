"""/api/v1/catalog/"""
from django.urls import path

from . import views

urlpatterns = [
    # Espace artiste
    path("me/artworks/", views.MyArtworkListView.as_view(), name="catalog-my-artworks"),
    path("me/artworks/<slug:slug>/", views.MyArtworkDetailView.as_view(), name="catalog-my-artwork"),
    path("me/artworks/<slug:slug>/submit/", views.MyArtworkSubmitView.as_view(), name="catalog-my-artwork-submit"),
    path("me/gallery/", views.MyGalleryView.as_view(), name="catalog-my-gallery"),
    # Public
    path("artists/", views.PublicArtistListView.as_view(), name="catalog-artists"),
    path("artists/<slug:slug>/", views.PublicArtistDetailView.as_view(), name="catalog-artist"),
    path("artworks/", views.PublicArtworkListView.as_view(), name="catalog-artworks"),
    path("artworks/<slug:slug>/", views.PublicArtworkDetailView.as_view(), name="catalog-artwork"),
    path("artworks/<slug:slug>/image/", views.ArtworkImageView.as_view(), name="catalog-artwork-image"),
    path("artworks/<slug:slug>/excerpt/", views.ArtworkExcerptView.as_view(), name="catalog-artwork-excerpt"),
    path("free-galleries/", views.FreeGalleryListView.as_view(), name="catalog-free-galleries"),
    path("frames/", views.FrameListView.as_view(), name="catalog-frames"),
    path("search/", views.SearchView.as_view(), name="catalog-search"),
]
