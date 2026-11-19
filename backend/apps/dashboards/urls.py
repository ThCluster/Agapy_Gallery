"""/api/v1/dashboards/"""
from django.urls import path

from . import views

urlpatterns = [
    path("me/summary/", views.MySummaryView.as_view(), name="dashboard-summary"),
    path("me/revenue/", views.MyRevenueView.as_view(), name="dashboard-revenue"),
    path("staff/overview/", views.StaffOverviewView.as_view(), name="dashboard-staff-overview"),
]
