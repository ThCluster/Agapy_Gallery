"""/api/v1/accounts/ : inscription et compte de l'artiste connecté."""
from django.urls import path

from .. import views

urlpatterns = [
    path("signup/", views.SignupView.as_view(), name="accounts-signup"),
    path("me/", views.MeView.as_view(), name="accounts-me"),
    path("me/payout/", views.PayoutView.as_view(), name="accounts-payout"),
]
