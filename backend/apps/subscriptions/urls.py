"""/api/v1/subscriptions/"""
from django.urls import path

from . import views

urlpatterns = [
    path("me/", views.SubscriptionMeView.as_view(), name="subscription-me"),
    path("me/renew/", views.RenewView.as_view(), name="subscription-renew"),
    path("me/wallet/", views.WalletView.as_view(), name="wallet-me"),
    path("me/wallet/topup/", views.WalletTopupView.as_view(), name="wallet-topup"),
]
