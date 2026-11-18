import django_filters

from apps.countries.models import Pais

from .models import Alerta, IndiceRiesgo


class RankingFilter(django_filters.FilterSet):
    region = django_filters.ChoiceFilter(field_name='pais__region', choices=Pais.Region.choices)

    class Meta:
        model = IndiceRiesgo
        fields = ('nivel_riesgo', 'region')


class HistoricoFilter(django_filters.FilterSet):
    fecha_desde = django_filters.DateFilter(field_name='fecha_calculo', lookup_expr='date__gte',
                                            label='Fecha desde')
    fecha_hasta = django_filters.DateFilter(field_name='fecha_calculo', lookup_expr='date__lte',
                                            label='Fecha hasta')

    class Meta:
        model = IndiceRiesgo
        fields = ('fecha_desde', 'fecha_hasta', 'nivel_riesgo')


class AlertaFilter(django_filters.FilterSet):
    tipo = django_filters.ChoiceFilter(field_name='tipo_alerta', choices=Alerta.TipoAlerta.choices)

    class Meta:
        model = Alerta
        fields = ('leida', 'tipo', 'severidad', 'pais')
