"""/api/v1/visitors/ : inscription et espace du visiteur (client)."""
from django.urls import path

from . import views

urlpatterns = [
    path("signup/code/", views.SignupCodeView.as_view(), name="visitors-signup-code"),
    path("signup/", views.SignupView.as_view(), name="visitors-signup"),
    path("me/", views.MeView.as_view(), name="visitors-me"),
    path("me/wallet/", views.VisitorWalletView.as_view(), name="visitors-wallet"),
    path("me/wallet/topup/", views.VisitorWalletTopupView.as_view(), name="visitors-wallet-topup"),
    path("me/visits/", views.MyVisitsView.as_view(), name="visitors-visits"),
    path("me/payments/", views.MyPaymentsView.as_view(), name="visitors-payments"),
]
