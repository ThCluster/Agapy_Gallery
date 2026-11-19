"""/api/v1/auth/ : session et mot de passe. Le cookie de rafraîchissement est limité à ce chemin."""
from django.urls import path

from .. import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("password/change/", views.PasswordChangeView.as_view(), name="auth-password-change"),
    path("password/forgot/", views.ForgotRequestView.as_view(), name="auth-password-forgot"),
    path("password/verify/", views.ForgotVerifyView.as_view(), name="auth-password-verify"),
    path("password/reset/", views.ForgotResetView.as_view(), name="auth-password-reset"),
]
