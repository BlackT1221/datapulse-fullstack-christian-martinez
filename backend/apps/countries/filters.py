import django_filters

from .models import IndicadorEconomico, Pais, TipoCambio


class PaisFilter(django_filters.FilterSet):
    class Meta:
        model = Pais
        fields = ('region', 'activo')


class IndicadorFilter(django_filters.FilterSet):
    anio_desde = django_filters.NumberFilter(field_name='anio', lookup_expr='gte', label='Año desde')
    anio_hasta = django_filters.NumberFilter(field_name='anio', lookup_expr='lte', label='Año hasta')

    class Meta:
        model = IndicadorEconomico
        fields = ('tipo', 'anio', 'fuente')


class TipoCambioFilter(django_filters.FilterSet):
    fecha_desde = django_filters.DateFilter(field_name='fecha', lookup_expr='gte', label='Fecha desde')
    fecha_hasta = django_filters.DateFilter(field_name='fecha', lookup_expr='lte', label='Fecha hasta')

    class Meta:
        model = TipoCambio
        fields = ('fecha_desde', 'fecha_hasta')
