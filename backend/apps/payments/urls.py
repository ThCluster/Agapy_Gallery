"""/api/v1/payments/"""
from django.urls import path, re_path

from . import views

urlpatterns = [
    path("quote/", views.QuoteView.as_view(), name="payments-quote"),
    path("signup/", views.SignupPaymentView.as_view(), name="payments-signup"),
    path("visits/", views.VisitPaymentView.as_view(), name="payments-visit"),
    path("visits/access/", views.VisitAccessView.as_view(), name="payments-visit-access"),
    path("donations/", views.DonationView.as_view(), name="payments-donation"),
    path("me/balance/", views.BalanceView.as_view(), name="payments-balance"),
    path("me/transactions/", views.TransactionListView.as_view(), name="payments-transactions"),
    path("me/payouts/", views.PayoutView.as_view(), name="payments-payouts"),
    path("webhook/<slug:provider>/", views.WebhookView.as_view(), name="payments-webhook"),
    re_path(r"^(?P<reference>[0-9a-f]{32})/$", views.PaymentStatusView.as_view(), name="payments-status"),
    re_path(r"^(?P<reference>[0-9a-f]{32})/simulate/$", views.SimulateView.as_view(), name="payments-simulate"),
]
