from rest_framework.routers import DefaultRouter

from .views import PaisViewSet

router = DefaultRouter(trailing_slash=True)
router.register('paises', PaisViewSet, basename='pais')

urlpatterns = router.urls
