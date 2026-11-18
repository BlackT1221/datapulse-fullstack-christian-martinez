from django.db.models import Sum
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.countries.models import Pais

from .models import MONTO_MAXIMO_POSICION, MONTO_MINIMO_POSICION, Portafolio, Posicion
from .services import MAX_POSICIONES_ACTIVAS_IGUALES, MONTO_MAXIMO_ACTIVO_PORTAFOLIO, calcular_metricas


def _usd(valor):
    return f'${valor:,.2f} USD'


class PosicionSerializer(serializers.ModelSerializer):
    pais = serializers.PrimaryKeyRelatedField(
        queryset=Pais.objects.filter(activo=True),
        error_messages={'does_not_exist': 'El país "{pk_value}" no existe o no está activo.'},
    )
    pais_nombre = serializers.CharField(source='pais.nombre', read_only=True)
    tipo_activo_display = serializers.CharField(source='get_tipo_activo_display', read_only=True)
    monto_inversion_usd = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=MONTO_MINIMO_POSICION, max_value=MONTO_MAXIMO_POSICION,
        error_messages={
            'min_value': f'El monto mínimo por posición es {_usd(MONTO_MINIMO_POSICION)}.',
            'max_value': f'El monto máximo por posición es {_usd(MONTO_MAXIMO_POSICION)}.',
        },
    )
    notas = serializers.CharField(
        required=False, allow_blank=True, max_length=200,
        error_messages={'max_length': 'Las notas no pueden superar los 200 caracteres.'},
    )
    esta_activa = serializers.BooleanField(read_only=True)

    class Meta:
        model = Posicion
        fields = ('id', 'portafolio', 'pais', 'pais_nombre', 'tipo_activo', 'tipo_activo_display',
                  'fecha_entrada', 'monto_inversion_usd', 'fecha_salida', 'notas', 'esta_activa')
        read_only_fields = ('portafolio',)

    def validate_fecha_entrada(self, fecha):
        if fecha > timezone.localdate():
            raise serializers.ValidationError('La fecha de entrada no puede ser futura.')
        return fecha

    def _valor(self, attrs, campo):
        return attrs[campo] if campo in attrs else getattr(self.instance, campo, None)

    def validate(self, attrs):
        portafolio = self.context['portafolio']
        pais, tipo = self._valor(attrs, 'pais'), self._valor(attrs, 'tipo_activo')
        monto = self._valor(attrs, 'monto_inversion_usd')
        entrada, salida = self._valor(attrs, 'fecha_entrada'), self._valor(attrs, 'fecha_salida')
        errores = {}

        if salida is not None and entrada is not None and salida <= entrada:
            errores['fecha_salida'] = ['La fecha de salida debe ser posterior a la fecha de entrada.']

        # 1. Sin posiciones de tipo MONEDA en países dolarizados.
        if tipo == Posicion.TipoActivo.MONEDA and pais.moneda_codigo == 'USD':
            errores['tipo_activo'] = [
                f'No se permite el tipo de activo MONEDA para {pais.nombre}: su moneda es el dólar '
                'estadounidense (USD).'
            ]

        if salida is None:  # Las reglas 2 y 3 solo aplican a posiciones activas.
            otras = portafolio.posiciones.filter(fecha_salida__isnull=True)
            if self.instance is not None:
                otras = otras.exclude(pk=self.instance.pk)

            # 2. Límite de monto activo total por portafolio.
            activo = otras.aggregate(total=Sum('monto_inversion_usd'))['total'] or 0
            limite = MONTO_MAXIMO_ACTIVO_PORTAFOLIO
            if activo + monto > limite:
                errores['monto_inversion_usd'] = [
                    f'El monto activo total del portafolio no puede superar {_usd(limite)}. '
                    f'Monto activo actual: {_usd(activo)}; disponible: {_usd(limite - activo)}.'
                ]

            # 3. Máximo de posiciones activas del mismo tipo en el mismo país.
            if otras.filter(pais=pais, tipo_activo=tipo).count() >= MAX_POSICIONES_ACTIVAS_IGUALES:
                errores['non_field_errors'] = [
                    f'Ya existen {MAX_POSICIONES_ACTIVAS_IGUALES} posiciones activas de '
                    f'{Posicion.TipoActivo(tipo).label} en {pais.nombre}; es el máximo permitido.'
                ]

        if errores:
            raise serializers.ValidationError(errores)
        return attrs


class PortafolioSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(
        min_length=3, max_length=100,
        error_messages={'min_length': 'El nombre debe tener al menos 3 caracteres.',
                        'max_length': 'El nombre no puede superar los 100 caracteres.'},
    )
    descripcion = serializers.CharField(
        required=False, allow_blank=True, max_length=500,
        error_messages={'max_length': 'La descripción no puede superar los 500 caracteres.'},
    )
    usuario = serializers.PrimaryKeyRelatedField(read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre_completo', read_only=True)
    es_propio = serializers.SerializerMethodField()
    monto_total_activo = serializers.SerializerMethodField()
    posiciones_activas = serializers.SerializerMethodField()
    fecha_modificacion = serializers.DateTimeField(
        required=False,
        help_text='Obligatorio en PUT: valor recibido al consultar el portafolio (bloqueo optimista).',
    )

    class Meta:
        model = Portafolio
        fields = ('id', 'nombre', 'descripcion', 'es_publico', 'activo', 'usuario', 'usuario_nombre',
                  'es_propio', 'monto_total_activo', 'posiciones_activas', 'fecha_creacion',
                  'fecha_modificacion')
        read_only_fields = ('activo', 'fecha_creacion')

    def get_es_propio(self, portafolio) -> bool:
        request = self.context.get('request')
        return bool(request and portafolio.usuario_id == request.user.pk)

    def get_monto_total_activo(self, portafolio) -> float:
        total = getattr(portafolio, 'total_activo', None)
        if total is None:
            total = portafolio.posiciones.filter(fecha_salida__isnull=True).aggregate(
                t=Sum('monto_inversion_usd'))['t']
        return round(float(total or 0), 2)

    def get_posiciones_activas(self, portafolio) -> int:
        cantidad = getattr(portafolio, 'num_activas', None)
        if cantidad is None:
            cantidad = portafolio.posiciones.filter(fecha_salida__isnull=True).count()
        return cantidad

    def validate_nombre(self, nombre):
        nombre = nombre.strip()
        propietario = self.instance.usuario if self.instance else self.context['request'].user
        existentes = Portafolio.objects.filter(usuario=propietario, nombre__iexact=nombre)
        if self.instance is not None:
            existentes = existentes.exclude(pk=self.instance.pk)
        existente = existentes.first()
        if existente is not None:
            raise serializers.ValidationError(
                'Ya tienes un portafolio con este nombre.' if existente.activo
                else 'Ya existe un portafolio eliminado con este nombre; elige otro.'
            )
        return nombre

    def create(self, validated_data):
        validated_data.pop('fecha_modificacion', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('fecha_modificacion', None)
        return super().update(instance, validated_data)


class PortafolioDetalleSerializer(PortafolioSerializer):
    posiciones = serializers.SerializerMethodField()
    metricas = serializers.SerializerMethodField()

    class Meta(PortafolioSerializer.Meta):
        fields = PortafolioSerializer.Meta.fields + ('posiciones', 'metricas')

    def _posiciones(self, portafolio):
        if not hasattr(self, '_cache_posiciones'):
            self._cache_posiciones = list(
                portafolio.posiciones.select_related('pais').order_by('-fecha_entrada')
            )
        return self._cache_posiciones

    @extend_schema_field(PosicionSerializer(many=True))
    def get_posiciones(self, portafolio):
        return PosicionSerializer(self._posiciones(portafolio), many=True).data

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_metricas(self, portafolio):
        return calcular_metricas(portafolio, self._posiciones(portafolio))
