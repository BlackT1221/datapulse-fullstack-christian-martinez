import logging

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.auditoria import registrar_actividad
from apps.core.filtros import filtrar_y_ordenar
from apps.core.models import LogActividad
from apps.risk.selectors import anotar_ultimo_irpc
from apps.risk.services import recalcular_todos
from apps.users.permissions import EsAdmin

from . import services
from .filters import IndicadorFilter, PaisFilter, TipoCambioFilter
from .models import Pais
from .serializers import (
    IndicadorEconomicoSerializer, PaisDetalleSerializer, PaisSerializer, ResultadoSincronizacionSerializer,
    TipoCambioSerializer,
)

logger = logging.getLogger(__name__)
TAG = ['Países e indicadores']


@extend_schema_view(
    list=extend_schema(tags=TAG, summary='Listar países (filtro por región, búsqueda y orden)'),
    retrieve=extend_schema(tags=TAG, summary='Detalle de país con indicadores actuales e IRPC'),
)
class PaisViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsAuthenticated,)
    lookup_field = 'codigo_iso'
    lookup_value_regex = '[A-Za-z]{2}'
    filterset_class = PaisFilter
    search_fields = ('nombre', 'codigo_iso', 'moneda_codigo', 'moneda_nombre')
    ordering_fields = ('nombre', 'codigo_iso', 'region', 'poblacion', 'irpc')
    ordering = ('nombre',)

    def get_queryset(self):
        return anotar_ultimo_irpc(Pais.objects.all())

    def get_serializer_class(self):
        return PaisDetalleSerializer if self.action == 'retrieve' else PaisSerializer

    def get_object(self):
        self.kwargs[self.lookup_field] = self.kwargs[self.lookup_field].upper()
        return super().get_object()

    def _paginar(self, queryset, serializer_class):
        pagina = self.paginate_queryset(queryset)
        return self.get_paginated_response(serializer_class(pagina, many=True).data)

    @extend_schema(
        tags=TAG, summary='Indicadores de un país', responses=IndicadorEconomicoSerializer(many=True),
        parameters=[
            OpenApiParameter('tipo', OpenApiTypes.STR, description='PIB, INFLACION, DESEMPLEO, ...'),
            OpenApiParameter('anio', OpenApiTypes.INT), OpenApiParameter('anio_desde', OpenApiTypes.INT),
            OpenApiParameter('anio_hasta', OpenApiTypes.INT),
            OpenApiParameter('ordering', OpenApiTypes.STR, description='anio, -anio, tipo, valor'),
        ],
    )
    @action(detail=True, methods=['get'], filter_backends=[])
    def indicadores(self, request, codigo_iso=None):
        pais = self.get_object()
        queryset = filtrar_y_ordenar(
            request, IndicadorFilter, pais.indicadores.all(), ('anio', 'tipo', 'valor'), ('tipo', '-anio'),
        )
        return self._paginar(queryset, IndicadorEconomicoSerializer)

    @extend_schema(
        tags=TAG, summary='Histórico de tipo de cambio', responses=TipoCambioSerializer(many=True),
        parameters=[
            OpenApiParameter('fecha_desde', OpenApiTypes.DATE),
            OpenApiParameter('fecha_hasta', OpenApiTypes.DATE),
            OpenApiParameter('ordering', OpenApiTypes.STR, description='fecha, -fecha, tasa'),
        ],
    )
    @action(detail=True, methods=['get'], url_path='tipo-cambio', filter_backends=[])
    def tipo_cambio(self, request, codigo_iso=None):
        pais = self.get_object()
        queryset = filtrar_y_ordenar(
            request, TipoCambioFilter, pais.tipos_cambio.all(), ('fecha', 'tasa', 'variacion_porcentual'),
            ('-fecha',),
        )
        return self._paginar(queryset, TipoCambioSerializer)

    @extend_schema(
        tags=TAG, request=None, responses=ResultadoSincronizacionSerializer,
        summary='Sincronizar indicadores, tipos de cambio y recalcular IRPC (solo ADMIN)',
    )
    @action(detail=False, methods=['post'], url_path='sync-indicadores', permission_classes=[EsAdmin],
            filter_backends=[], pagination_class=None)
    def sync_indicadores(self, request):
        indicadores = services.sincronizar_indicadores()
        tipos_cambio = services.actualizar_tipos_cambio()
        calculados, errores_irpc = recalcular_todos()
        cuerpo = {
            'indicadores': vars(indicadores),
            'tipos_cambio': vars(tipos_cambio),
            'irpc': {'calculados': len(calculados), 'errores': errores_irpc},
        }
        registrar_actividad(
            request, LogActividad.Accion.EDITAR, entidad='IndicadorEconomico',
            detalle={'accion': 'sincronizacion', 'actualizados': indicadores.actualizados,
                     'errores': len(indicadores.errores) + len(tipos_cambio.errores)},
        )
        logger.info('Sincronización manual ejecutada por %s', request.user)
        return Response(cuerpo)
