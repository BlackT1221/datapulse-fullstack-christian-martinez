from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import exceptions, viewsets
from rest_framework.response import Response

from apps.core.auditoria import AuditoriaMixin, registrar_actividad
from apps.core.models import LogActividad
from apps.users.permissions import EsPropietarioOPublico, PuedeEditarPortafolios

from .filters import PosicionFilter
from .models import Portafolio, Posicion
from .serializers import PosicionSerializer
from .views import portafolios_visibles

TAG = ['Posiciones']


@extend_schema_view(
    list=extend_schema(tags=TAG, summary='Posiciones de un portafolio (filtros: activa, pais, tipo_activo)'),
    create=extend_schema(tags=TAG, summary='Agregar posición (valida reglas cruzadas)'),
    retrieve=extend_schema(tags=TAG, summary='Detalle de posición'),
    update=extend_schema(tags=TAG, summary='Editar posición'),
    destroy=extend_schema(tags=TAG, summary='Cerrar posición (fija fecha_salida = hoy)',
                          responses=PosicionSerializer),
)
class PosicionViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    serializer_class = PosicionSerializer
    permission_classes = (PuedeEditarPortafolios, EsPropietarioOPublico)
    http_method_names = ('get', 'post', 'put', 'delete', 'head', 'options')
    filterset_class = PosicionFilter
    search_fields = ('notas', 'pais__nombre')
    ordering_fields = ('fecha_entrada', 'fecha_salida', 'monto_inversion_usd', 'pais__nombre')
    ordering = ('-fecha_entrada',)

    def get_portafolio(self):
        """Portafolio padre: 404 si no es visible; 403 si se intenta escribir sin ser propietario."""
        if not hasattr(self, '_portafolio'):
            portafolio = get_object_or_404(
                portafolios_visibles(self.request.user), pk=self.kwargs['portafolio_pk'],
            )
            self.check_object_permissions(self.request, portafolio)
            self._portafolio = portafolio
        return self._portafolio

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Posicion.objects.none()
        return self.get_portafolio().posiciones.select_related('pais', 'portafolio')

    def get_serializer_context(self):
        contexto = super().get_serializer_context()
        if not getattr(self, 'swagger_fake_view', False):
            contexto['portafolio'] = self.get_portafolio()
        return contexto

    def _bloquear_y_tocar(self):
        """Bloquea la fila del portafolio (serializa altas concurrentes) y actualiza su versión."""
        portafolio = self.get_portafolio()
        Portafolio.objects.select_for_update().filter(pk=portafolio.pk).first()
        return portafolio

    def _tocar(self):
        Portafolio.objects.filter(pk=self.get_portafolio().pk).update(fecha_modificacion=timezone.now())

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
            self._bloquear_y_tocar()
            return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        with transaction.atomic():
            self._bloquear_y_tocar()
            return super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        posicion = serializer.save(portafolio=self.get_portafolio())
        self._tocar()
        registrar_actividad(self.request, LogActividad.Accion.CREAR, posicion)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        self._tocar()

    def destroy(self, request, *args, **kwargs):
        posicion = self.get_object()
        hoy = timezone.localdate()
        if posicion.fecha_salida is not None:
            raise exceptions.ValidationError({'fecha_salida': ['La posición ya está cerrada.']})
        if hoy <= posicion.fecha_entrada:
            raise exceptions.ValidationError({'fecha_salida': [
                'No se puede cerrar la posición el mismo día de su entrada: '
                'la fecha de salida debe ser posterior.'
            ]})
        posicion.fecha_salida = hoy
        posicion.save(update_fields=['fecha_salida'])
        self._tocar()
        registrar_actividad(request, LogActividad.Accion.ELIMINAR, posicion,
                            detalle={'accion': 'cerrar_posicion', 'fecha_salida': hoy.isoformat()})
        return Response(self.get_serializer(posicion).data)
