"""Registro de acciones de negocio en `LogActividad`."""
import logging

from .models import LogActividad

logger = logging.getLogger('apps.core.auditoria')


def obtener_ip(request):
    if request is None:
        return None
    reenviada = request.META.get('HTTP_X_FORWARDED_FOR')
    if reenviada:
        return reenviada.split(',')[0].strip() or None
    return request.META.get('REMOTE_ADDR') or None


def registrar_actividad(request, accion, instancia=None, *, entidad=None, entidad_id=None, detalle=None,
                        usuario=None):
    """
    Guarda un registro de auditoría. Nunca interrumpe la operación de negocio:
    si la escritura falla se registra el error en el log y se continúa.
    """
    if usuario is None and request is not None:
        candidato = getattr(request, 'user', None)
        usuario = candidato if candidato is not None and candidato.is_authenticated else None
    if instancia is not None:
        entidad = entidad or instancia.__class__.__name__
        entidad_id = entidad_id if entidad_id is not None else instancia.pk
    try:
        return LogActividad.objects.create(
            usuario=usuario,
            accion=accion,
            entidad_afectada=entidad or '',
            entidad_id='' if entidad_id is None else str(entidad_id),
            detalle=detalle or {},
            ip_address=obtener_ip(request),
        )
    except Exception:  # noqa: BLE001 - la auditoría no debe romper la petición
        logger.exception('No se pudo registrar la actividad %s sobre %s', accion, entidad)
        return None


class AuditoriaMixin:
    """
    Mixin para ViewSets/vistas genéricas que registra CREAR, EDITAR y ELIMINAR en
    `LogActividad`. Con `auditar_consultas = True` también registra CONSULTAR en `retrieve`.
    """

    auditar_consultas = False

    def perform_create(self, serializer):
        instancia = serializer.save()
        registrar_actividad(self.request, LogActividad.Accion.CREAR, instancia)

    def perform_update(self, serializer):
        instancia = serializer.save()
        registrar_actividad(
            self.request, LogActividad.Accion.EDITAR, instancia,
            detalle={'campos': sorted(serializer.validated_data)},
        )

    def perform_destroy(self, instancia):
        entidad, entidad_id = instancia.__class__.__name__, instancia.pk
        instancia.delete()
        registrar_actividad(
            self.request, LogActividad.Accion.ELIMINAR, entidad=entidad, entidad_id=entidad_id,
        )

    def retrieve(self, request, *args, **kwargs):
        respuesta = super().retrieve(request, *args, **kwargs)
        if self.auditar_consultas:
            registrar_actividad(request, LogActividad.Accion.CONSULTAR, self.get_object())
        return respuesta
