from rest_framework.routers import DefaultRouter

from .views import AlertaViewSet, RiesgoViewSet

router = DefaultRouter(trailing_slash=True)
router.register('riesgo', RiesgoViewSet, basename='riesgo')
router.register('alertas', AlertaViewSet, basename='alerta')

urlpatterns = router.urls
