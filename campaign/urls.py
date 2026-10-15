
from django.urls import path
from . import views

urlpatterns = [
    path(
        "campaign-video/",
        views.campaign_video,
        name="campaign_video",
    ),
    path("", views.home, name="home"),
]
