from django.urls import path

from .dashboard import MapaDashboardView, ResumenDashboardView, TendenciasDashboardView

urlpatterns = [
    path('resumen/', ResumenDashboardView.as_view(), name='dashboard-resumen'),
    path('mapa/', MapaDashboardView.as_view(), name='dashboard-mapa'),
    path('tendencias/', TendenciasDashboardView.as_view(), name='dashboard-tendencias'),
]
