from django.db.models import Count
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view, inline_serializer
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.auditoria import registrar_actividad
from apps.core.models import LogActividad
from apps.core.filtros import filtrar_y_ordenar
from apps.users.permissions import EsAdmin

from .filters import AlertaFilter, HistoricoFilter, RankingFilter
from .models import Alerta, IndiceRiesgo
from .selectors import alertas_visibles, ultimos_indices
from .serializers import (
    AlertaSerializer, IndiceHistoricoSerializer, RankingSerializer, ResumenAlertasSerializer,
    RiesgoDetalleSerializer,
)
from .services import recalcular_todos

TAG_RIESGO = ['Índice de riesgo']
TAG_ALERTAS = ['Alertas']
CODIGO_ISO = OpenApiParameter('codigo_iso', OpenApiTypes.STR, OpenApiParameter.PATH, description='Ej.: CO')


@extend_schema_view(
    list=extend_schema(tags=TAG_RIESGO, summary='Ranking de países por IRPC (último cálculo)'),
    retrieve=extend_schema(tags=TAG_RIESGO, summary='Detalle de riesgo de un país con histórico reciente',
                           parameters=[CODIGO_ISO]),
)
class RiesgoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = (IsAuthenticated,)
    lookup_field = 'pais_id'
    lookup_url_kwarg = 'codigo_iso'
    lookup_value_regex = '[A-Za-z]{2}'
    filterset_class = RankingFilter
    search_fields = ('pais__nombre', 'pais__codigo_iso')
    ordering_fields = ('indice_compuesto', 'score_economico', 'score_cambiario', 'score_estabilidad',
                       'pais__nombre', 'fecha_calculo')
    ordering = ('-indice_compuesto', 'pais__nombre')  # mismo desempate que `posicion`

    def get_queryset(self):
        return ultimos_indices()

    def get_serializer_class(self):
        return RiesgoDetalleSerializer if self.action == 'retrieve' else RankingSerializer

    def get_serializer_context(self):
        contexto = super().get_serializer_context()
        if self.action == 'list':
            orden = (ultimos_indices().order_by('-indice_compuesto', 'pais__nombre')
                     .values_list('pk', flat=True))
            contexto['posiciones'] = {pk: numero for numero, pk in enumerate(orden, start=1)}
        return contexto

    def get_object(self):
        self.kwargs[self.lookup_url_kwarg] = self.kwargs[self.lookup_url_kwarg].upper()
        return super().get_object()

    @extend_schema(
        tags=TAG_RIESGO, summary='Histórico de índices de un país (filtro por rango de fechas)',
        responses=IndiceHistoricoSerializer(many=True),
        parameters=[
            CODIGO_ISO, OpenApiParameter('fecha_desde', OpenApiTypes.DATE),
            OpenApiParameter('fecha_hasta', OpenApiTypes.DATE),
            OpenApiParameter('ordering', OpenApiTypes.STR, description='fecha_calculo, -fecha_calculo, ...'),
        ],
    )
    @action(detail=True, methods=['get'], filter_backends=[])
    def historico(self, request, codigo_iso=None):
        indice = self.get_object()
        queryset = filtrar_y_ordenar(
            request, HistoricoFilter, IndiceRiesgo.objects.filter(pais=indice.pais).select_related('pais'),
            ('fecha_calculo', 'indice_compuesto'), ('-fecha_calculo',),
        )
        pagina = self.paginate_queryset(queryset)
        return self.get_paginated_response(IndiceHistoricoSerializer(pagina, many=True).data)

    @extend_schema(
        tags=TAG_RIESGO, request=None, summary='Recalcular el IRPC de todos los países (solo ADMIN)',
        responses=inline_serializer('ResultadoRecalculo', {
            'calculados': serializers.IntegerField(), 'errores': serializers.ListField(),
            'ranking': RankingSerializer(many=True),
        }),
    )
    @action(detail=False, methods=['post'], permission_classes=[EsAdmin], filter_backends=[],
            pagination_class=None)
    def calcular(self, request):
        calculados, errores = recalcular_todos()
        registrar_actividad(request, LogActividad.Accion.CREAR, entidad='IndiceRiesgo',
                            detalle={'calculados': len(calculados), 'errores': errores})
        ranking = ultimos_indices().order_by('-indice_compuesto')
        return Response({
            'calculados': len(calculados), 'errores': errores,
            'ranking': RankingSerializer(ranking, many=True).data,
        })


@extend_schema_view(
    list=extend_schema(tags=TAG_ALERTAS,
                       summary='Alertas del usuario y globales (filtros: leida, tipo, severidad)'),
    retrieve=extend_schema(tags=TAG_ALERTAS, summary='Detalle de alerta'),
)
class AlertaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Las alertas globales (usuario nulo) son compartidas: el campo `leida` del modelo es único, por lo
    que marcarlas como leídas aplica para todos los usuarios.
    """

    serializer_class = AlertaSerializer
    permission_classes = (IsAuthenticated,)
    filterset_class = AlertaFilter
    search_fields = ('titulo', 'mensaje', 'pais__nombre')
    ordering_fields = ('fecha_creacion', 'severidad', 'tipo_alerta', 'leida')
    ordering = ('-fecha_creacion',)

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Alerta.objects.none()
        return alertas_visibles(self.request.user)

    @extend_schema(tags=TAG_ALERTAS, request=None, summary='Marcar alerta como leída')
    @action(detail=True, methods=['put'])
    def leer(self, request, pk=None):
        alerta = self.get_object()
        if not alerta.leida:
            alerta.leida = True
            alerta.save(update_fields=['leida'])
        return Response(self.get_serializer(alerta).data)

    @extend_schema(
        tags=TAG_ALERTAS, request=None, summary='Marcar todas las alertas como leídas',
        responses=inline_serializer('ResultadoLeerTodas', {'actualizadas': serializers.IntegerField()}),
    )
    @action(detail=False, methods=['put'], url_path='leer-todas', filter_backends=[], pagination_class=None)
    def leer_todas(self, request):
        actualizadas = self.get_queryset().filter(leida=False).update(leida=True)
        return Response({'actualizadas': actualizadas})

    @extend_schema(tags=TAG_ALERTAS, summary='Conteo de alertas por tipo y severidad',
                   responses=ResumenAlertasSerializer)
    @action(detail=False, methods=['get'], filter_backends=[], pagination_class=None)
    def resumen(self, request):
        alertas = self.get_queryset()

        def conteo(queryset, campo, opciones):
            valores = dict(queryset.values_list(campo).annotate(n=Count('pk')).order_by())
            return {opcion: valores.get(opcion, 0) for opcion in opciones}

        no_leidas = alertas.filter(leida=False)
        return Response({
            'total': alertas.count(),
            'no_leidas': no_leidas.count(),
            'por_tipo': conteo(alertas, 'tipo_alerta', Alerta.TipoAlerta.values),
            'por_severidad': conteo(alertas, 'severidad', Alerta.Severidad.values),
            'no_leidas_por_severidad': conteo(no_leidas, 'severidad', Alerta.Severidad.values),
        })
