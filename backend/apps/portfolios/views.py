from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import exceptions, viewsets
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from apps.core.auditoria import AuditoriaMixin, registrar_actividad
from apps.core.exceptions import Conflicto
from apps.core.models import LogActividad
from apps.users.models import Usuario
from apps.users.permissions import EsPropietarioOPublico, PuedeEditarPortafolios

from .exportacion import generar_pdf, generar_xlsx
from .filters import PortafolioFilter
from .models import Portafolio
from .renderers import PdfRenderer, RespuestasErrorJsonMixin, XlsxRenderer
from .serializers import PortafolioDetalleSerializer, PortafolioSerializer
from .services import calcular_metricas

TAG = ['Portafolios']
ACTIVAS = Q(posiciones__fecha_salida__isnull=True)


def portafolios_visibles(usuario):
    """Portafolios activos propios + públicos; ADMIN ve todos los activos."""
    queryset = Portafolio.objects.filter(activo=True).select_related('usuario')
    if getattr(usuario, 'rol', None) != Usuario.Rol.ADMIN:
        queryset = queryset.filter(Q(usuario=usuario) | Q(es_publico=True))
    return queryset


def verificar_version(portafolio, fecha_enviada):
    """Bloqueo optimista: la versión enviada debe coincidir con la almacenada."""
    if fecha_enviada is None:
        raise exceptions.ValidationError({'fecha_modificacion': [
            'Este campo es obligatorio al actualizar: envía el valor recibido al consultar el portafolio.'
        ]})
    if fecha_enviada != portafolio.fecha_modificacion:
        raise Conflicto({
            'detail': 'El portafolio fue modificado por otro usuario o en otra sesión mientras lo editabas. '
                      'Recarga el portafolio para ver los cambios más recientes e inténtalo de nuevo.',
            'fecha_modificacion_actual': timezone.localtime(portafolio.fecha_modificacion).isoformat(),
        })


@extend_schema_view(
    list=extend_schema(tags=TAG, summary='Listar portafolios propios y públicos'),
    create=extend_schema(tags=TAG, summary='Crear portafolio (ANALISTA o ADMIN)'),
    retrieve=extend_schema(tags=TAG, summary='Detalle con posiciones y métricas'),
    update=extend_schema(
        tags=TAG, summary='Actualizar portafolio (bloqueo optimista con fecha_modificacion)',
        responses={200: PortafolioDetalleSerializer, 409: OpenApiResponse(description='Edición simultánea')},
    ),
    destroy=extend_schema(tags=TAG, summary='Eliminar portafolio (soft delete)'),
)
class PortafolioViewSet(RespuestasErrorJsonMixin, AuditoriaMixin, viewsets.ModelViewSet):
    permission_classes = (PuedeEditarPortafolios, EsPropietarioOPublico)
    http_method_names = ('get', 'post', 'put', 'delete', 'head', 'options')
    filterset_class = PortafolioFilter
    search_fields = ('nombre', 'descripcion')
    ordering_fields = ('nombre', 'fecha_creacion', 'fecha_modificacion', 'total_activo')
    ordering = ('-fecha_modificacion',)
    auditar_consultas = True

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Portafolio.objects.none()
        return portafolios_visibles(self.request.user).annotate(
            total_activo=Sum('posiciones__monto_inversion_usd', filter=ACTIVAS),
            num_activas=Count('posiciones', filter=ACTIVAS),
        )

    def get_serializer_class(self):
        if self.action in ('retrieve', 'update'):
            return PortafolioDetalleSerializer
        return PortafolioSerializer

    def perform_create(self, serializer):
        portafolio = serializer.save(usuario=self.request.user)
        registrar_actividad(self.request, LogActividad.Accion.CREAR, portafolio)

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            visible = self.get_object()  # aplica visibilidad y permisos de objeto
            portafolio = Portafolio.objects.select_for_update().get(pk=visible.pk)
            serializer = self.get_serializer(portafolio, data=request.data)
            serializer.is_valid(raise_exception=True)
            verificar_version(portafolio, serializer.validated_data.get('fecha_modificacion'))
            self.perform_update(serializer)
        return Response(self.get_serializer(portafolio).data)

    def perform_destroy(self, portafolio):
        portafolio.activo = False
        portafolio.save(update_fields=['activo', 'fecha_modificacion'])
        registrar_actividad(self.request, LogActividad.Accion.ELIMINAR, portafolio,
                            detalle={'soft_delete': True})

    @extend_schema(tags=TAG, summary='Resumen: distribución por país, tipo de activo y riesgo ponderado',
                   responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=['get'])
    def resumen(self, request, pk=None):
        portafolio = self.get_object()
        return Response({'id': portafolio.pk, 'nombre': portafolio.nombre, **calcular_metricas(portafolio)})

    @extend_schema(
        tags=TAG, summary='Verificar si un nombre de portafolio está disponible (validación asíncrona)',
        parameters=[OpenApiParameter('nombre', OpenApiTypes.STR, required=True),
                    OpenApiParameter('excluir', OpenApiTypes.INT,
                                     description='ID del portafolio en edición')],
        responses=OpenApiTypes.OBJECT,
    )
    @action(detail=False, methods=['get'], url_path='verificar-nombre', filter_backends=[],
            pagination_class=None)
    def verificar_nombre(self, request):
        nombre = request.query_params.get('nombre', '').strip()
        if not nombre:
            raise exceptions.ValidationError({'nombre': ['Este parámetro es obligatorio.']})
        existentes = Portafolio.objects.filter(usuario=request.user, nombre__iexact=nombre)
        excluir = request.query_params.get('excluir', '')
        if excluir.isdigit():
            existentes = existentes.exclude(pk=int(excluir))
        disponible = not existentes.exists()
        return Response({'nombre': nombre, 'disponible': disponible,
                         'mensaje': None if disponible else 'Ya tienes un portafolio con este nombre.'})

    def _exportar(self, generador, extension, content_type):
        portafolio = self.get_object()
        posiciones = list(portafolio.posiciones.select_related('pais').order_by('-fecha_entrada'))
        contenido = generador(portafolio, calcular_metricas(portafolio, posiciones), posiciones)
        registrar_actividad(self.request, LogActividad.Accion.EXPORT, portafolio,
                            detalle={'formato': extension})
        nombre = f'portafolio-{slugify(portafolio.nombre) or portafolio.pk}-{timezone.localdate():%Y%m%d}'
        respuesta = HttpResponse(contenido, content_type=content_type)
        respuesta['Content-Disposition'] = f'attachment; filename="{nombre}.{extension}"'
        return respuesta

    @extend_schema(tags=TAG, summary='Exportar reporte PDF con gráficos',
                   responses={(200, 'application/pdf'): OpenApiTypes.BINARY})
    @action(detail=True, methods=['get'], url_path='export/pdf',
            renderer_classes=[JSONRenderer, PdfRenderer])
    def export_pdf(self, request, pk=None):
        return self._exportar(generar_pdf, 'pdf', PdfRenderer.media_type)

    @extend_schema(tags=TAG, summary='Exportar portafolio a Excel (.xlsx)',
                   responses={(200, XlsxRenderer.media_type): OpenApiTypes.BINARY})
    @action(detail=True, methods=['get'], url_path='export/xlsx',
            renderer_classes=[JSONRenderer, XlsxRenderer])
    def export_xlsx(self, request, pk=None):
        return self._exportar(generar_xlsx, 'xlsx', XlsxRenderer.media_type)
