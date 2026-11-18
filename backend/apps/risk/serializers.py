from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .irpc import clasificar
from .models import Alerta, IndiceRiesgo
from .selectors import variacion_y_tendencia


class IndiceRiesgoSerializer(serializers.ModelSerializer):
    pais_nombre = serializers.CharField(source='pais.nombre', read_only=True)
    color = serializers.SerializerMethodField()
    accion_recomendada = serializers.SerializerMethodField()

    class Meta:
        model = IndiceRiesgo
        fields = ('id', 'pais', 'pais_nombre', 'fecha_calculo', 'score_economico', 'score_cambiario',
                  'score_estabilidad', 'indice_compuesto', 'nivel_riesgo', 'color', 'accion_recomendada',
                  'detalle_calculo')
        read_only_fields = fields

    def get_color(self, indice) -> str:
        return clasificar(indice.indice_compuesto)[1]

    def get_accion_recomendada(self, indice) -> str:
        return clasificar(indice.indice_compuesto)[2]


class IndiceHistoricoSerializer(IndiceRiesgoSerializer):
    class Meta(IndiceRiesgoSerializer.Meta):
        fields = tuple(f for f in IndiceRiesgoSerializer.Meta.fields if f != 'detalle_calculo')
        read_only_fields = fields


class RankingSerializer(IndiceHistoricoSerializer):
    """Fila del ranking: incluye variación respecto al cálculo anterior y tendencia."""

    posicion = serializers.SerializerMethodField()
    bandera_url = serializers.CharField(source='pais.bandera_url', read_only=True)
    region = serializers.CharField(source='pais.region', read_only=True)
    variacion = serializers.SerializerMethodField()
    tendencia = serializers.SerializerMethodField()

    class Meta(IndiceHistoricoSerializer.Meta):
        fields = ('posicion',) + IndiceHistoricoSerializer.Meta.fields + (
            'bandera_url', 'region', 'variacion', 'tendencia',
        )
        read_only_fields = fields

    def _variacion(self, indice):
        return variacion_y_tendencia(indice.indice_compuesto, getattr(indice, 'indice_anterior', None))

    def get_posicion(self, indice) -> int | None:
        return self.context.get('posiciones', {}).get(indice.pk)

    def get_variacion(self, indice) -> float | None:
        return self._variacion(indice)[0]

    @extend_schema_field(serializers.ChoiceField(choices=['SUBE', 'BAJA', 'ESTABLE'], allow_null=True))
    def get_tendencia(self, indice):
        return self._variacion(indice)[1]


class RiesgoDetalleSerializer(IndiceRiesgoSerializer):
    historico = serializers.SerializerMethodField()

    class Meta(IndiceRiesgoSerializer.Meta):
        fields = IndiceRiesgoSerializer.Meta.fields + ('historico',)
        read_only_fields = fields

    @extend_schema_field(IndiceHistoricoSerializer(many=True))
    def get_historico(self, indice):
        recientes = indice.pais.indices_riesgo.order_by('-fecha_calculo', '-pk')[:12]
        return IndiceHistoricoSerializer(recientes, many=True).data


class AlertaSerializer(serializers.ModelSerializer):
    pais_nombre = serializers.CharField(source='pais.nombre', read_only=True)
    es_global = serializers.SerializerMethodField()

    class Meta:
        model = Alerta
        fields = ('id', 'usuario', 'es_global', 'pais', 'pais_nombre', 'tipo_alerta', 'severidad', 'titulo',
                  'mensaje', 'leida', 'fecha_creacion')
        read_only_fields = fields

    def get_es_global(self, alerta) -> bool:
        return alerta.usuario_id is None


class ResumenAlertasSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    no_leidas = serializers.IntegerField()
    por_tipo = serializers.DictField(child=serializers.IntegerField())
    por_severidad = serializers.DictField(child=serializers.IntegerField())
    no_leidas_por_severidad = serializers.DictField(child=serializers.IntegerField())
