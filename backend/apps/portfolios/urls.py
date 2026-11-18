from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PortafolioViewSet
from .views_posiciones import PosicionViewSet

router = DefaultRouter(trailing_slash=True)
router.register('portafolios', PortafolioViewSet, basename='portafolio')

posiciones = PosicionViewSet.as_view({'get': 'list', 'post': 'create'})
posicion = PosicionViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'})

urlpatterns = router.urls + [
    path('portafolios/<int:portafolio_pk>/posiciones/', posiciones, name='posicion-list'),
    path('portafolios/<int:portafolio_pk>/posiciones/<int:pk>/', posicion, name='posicion-detail'),
]
