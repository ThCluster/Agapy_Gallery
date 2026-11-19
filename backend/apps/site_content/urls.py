"""/api/v1/site/"""
from django.urls import path

from . import views

urlpatterns = [
    path("contact/", views.ContactView.as_view(), name="site-contact"),
    path("newsletter/", views.NewsletterSubscribeView.as_view(), name="newsletter-subscribe"),
    path("newsletter/unsubscribe/", views.NewsletterUnsubscribeView.as_view(), name="newsletter-unsubscribe"),
    path("partners/", views.PartnersView.as_view(), name="site-partners"),
    path("pages/<slug:slug>/", views.PageView.as_view(), name="site-page"),
    path("stats/", views.StatsView.as_view(), name="site-stats"),
]
