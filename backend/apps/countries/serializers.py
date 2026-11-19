from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.risk.irpc import clasificar

from .models import IndicadorEconomico, Pais, TipoCambio


class IndicadorEconomicoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = IndicadorEconomico
        fields = ('id', 'pais', 'tipo', 'tipo_display', 'valor', 'unidad', 'anio', 'fuente',
                  'fecha_actualizacion')
        read_only_fields = fields


class TipoCambioSerializer(serializers.ModelSerializer):
    moneda_origen = serializers.CharField(source='moneda_origen_id', read_only=True)

    class Meta:
        model = TipoCambio
        fields = ('id', 'moneda_origen', 'moneda_destino', 'tasa', 'fecha', 'variacion_porcentual', 'fuente')
        read_only_fields = fields


class PaisSerializer(serializers.ModelSerializer):
    region_display = serializers.CharField(source='get_region_display', read_only=True)
    irpc = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True, allow_null=True)
    nivel_riesgo = serializers.CharField(read_only=True, allow_null=True)
    color_riesgo = serializers.SerializerMethodField()

    class Meta:
        model = Pais
        fields = ('codigo_iso', 'nombre', 'moneda_codigo', 'moneda_nombre', 'region', 'region_display',
                  'latitud', 'longitud', 'poblacion', 'bandera_url', 'activo', 'irpc', 'nivel_riesgo',
                  'color_riesgo')
        read_only_fields = fields

    def get_color_riesgo(self, pais) -> str | None:
        irpc = getattr(pais, 'irpc', None)
        return clasificar(irpc)[1] if irpc is not None else None


class PaisDetalleSerializer(PaisSerializer):
    """Detalle con el valor más reciente de cada indicador y el último tipo de cambio."""

    indicadores_actuales = serializers.SerializerMethodField()
    tipo_cambio_actual = serializers.SerializerMethodField()

    class Meta(PaisSerializer.Meta):
        fields = PaisSerializer.Meta.fields + ('indicadores_actuales', 'tipo_cambio_actual')
        read_only_fields = fields

    @extend_schema_field(IndicadorEconomicoSerializer(many=True))
    def get_indicadores_actuales(self, pais):
        actuales = {}
        for indicador in pais.indicadores.order_by('tipo', '-anio'):
            actuales.setdefault(indicador.tipo, indicador)
        return IndicadorEconomicoSerializer(actuales.values(), many=True).data

    @extend_schema_field(TipoCambioSerializer(allow_null=True))
    def get_tipo_cambio_actual(self, pais):
        ultimo = pais.tipos_cambio.order_by('-fecha').first()
        return TipoCambioSerializer(ultimo).data if ultimo else None


class ResultadoSincronizacionSerializer(serializers.Serializer):
    """Solo para documentar la respuesta de /sync-indicadores/ en OpenAPI."""

    indicadores = serializers.DictField()
    tipos_cambio = serializers.DictField()
    irpc = serializers.DictField()
