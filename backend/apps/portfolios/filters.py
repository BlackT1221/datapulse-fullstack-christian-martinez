import django_filters

from .models import Portafolio, Posicion


class PortafolioFilter(django_filters.FilterSet):
    propios = django_filters.BooleanFilter(method='filtrar_propios', label='Solo mis portafolios')

    class Meta:
        model = Portafolio
        fields = ('es_publico', 'propios')

    def filtrar_propios(self, queryset, name, valor):
        if valor is None:
            return queryset
        usuario = self.request.user
        return queryset.filter(usuario=usuario) if valor else queryset.exclude(usuario=usuario)


class PosicionFilter(django_filters.FilterSet):
    activa = django_filters.BooleanFilter(field_name='fecha_salida', lookup_expr='isnull', label='Activa')

    class Meta:
        model = Posicion
        fields = ('activa', 'pais', 'tipo_activo')
