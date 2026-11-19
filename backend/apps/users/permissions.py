"""Permisos basados en el rol del usuario (ADMIN, ANALISTA, VIEWER)."""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Usuario

Rol = Usuario.Rol


def _rol(request):
    usuario = request.user
    if not (usuario and usuario.is_authenticated):
        return None
    return getattr(usuario, 'rol', None)


class EsAdmin(BasePermission):
    """Solo usuarios ADMIN (sincronización, recálculo de IRPC, administración)."""

    message = 'Esta acción requiere rol ADMIN.'

    def has_permission(self, request, view):
        return _rol(request) == Rol.ADMIN


class EsAnalista(BasePermission):
    """ANALISTA o ADMIN: pueden crear y modificar información de negocio."""

    message = 'Esta acción requiere rol ANALISTA o ADMIN.'

    def has_permission(self, request, view):
        return _rol(request) in (Rol.ADMIN, Rol.ANALISTA)


class EsViewer(BasePermission):
    """Cualquier rol autenticado, limitado a métodos de solo lectura."""

    message = 'Su rol solo permite consultar información.'

    def has_permission(self, request, view):
        return _rol(request) is not None and request.method in SAFE_METHODS


class PuedeEditarPortafolios(BasePermission):
    """Lectura para cualquier rol; escritura de portafolios/posiciones bloqueada a VIEWER (403)."""

    message = 'Los usuarios con rol VIEWER no pueden crear ni editar portafolios.'

    def has_permission(self, request, view):
        if _rol(request) is None:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.puede_editar_portafolios


class EsPropietarioOPublico(BasePermission):
    """
    A nivel de objeto (Portafolio o Posicion):
    - lectura: propietario, ADMIN o portafolio público;
    - escritura: propietario o ADMIN.
    """

    message = 'Solo el propietario del portafolio puede modificarlo.'

    def has_object_permission(self, request, view, obj):
        portafolio = getattr(obj, 'portafolio', obj)
        es_propietario = portafolio.usuario_id == request.user.pk
        es_admin = _rol(request) == Rol.ADMIN
        if request.method in SAFE_METHODS:
            return es_propietario or es_admin or portafolio.es_publico
        return es_propietario or es_admin
