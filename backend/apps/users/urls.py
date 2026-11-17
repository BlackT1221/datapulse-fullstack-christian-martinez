from django.urls import path

from .views import LoginView, PerfilView, RefreshView, RegistroView

urlpatterns = [
    path('register/', RegistroView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='token_obtain_pair'),
    path('refresh/', RefreshView.as_view(), name='token_refresh'),
    path('me/', PerfilView.as_view(), name='auth-me'),
]
