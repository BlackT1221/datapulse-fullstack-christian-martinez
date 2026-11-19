"""Manejador de excepciones con formato de error estandarizado en español."""
import logging

from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger('apps.core.exceptions')

MENSAJES_POR_CODIGO = {
    status.HTTP_400_BAD_REQUEST: 'La solicitud contiene datos inválidos.',
    status.HTTP_401_UNAUTHORIZED: 'Credenciales de autenticación no válidas o ausentes.',
    status.HTTP_403_FORBIDDEN: 'No tiene permisos para realizar esta acción.',
    status.HTTP_404_NOT_FOUND: 'El recurso solicitado no existe.',
    status.HTTP_405_METHOD_NOT_ALLOWED: 'Método HTTP no permitido.',
    status.HTTP_409_CONFLICT: 'Conflicto con el estado actual del recurso.',
    status.HTTP_429_TOO_MANY_REQUESTS: 'Demasiadas solicitudes. Intente más tarde.',
    status.HTTP_500_INTERNAL_SERVER_ERROR: 'Error interno del servidor.',
}


class Conflicto(exceptions.APIException):
    """HTTP 409: usado por el bloqueo optimista y violaciones de integridad."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = MENSAJES_POR_CODIGO[status.HTTP_409_CONFLICT]
    default_code = 'conflicto'


def _formatear(codigo, mensaje, detalles=None):
    return {'error': True, 'codigo': codigo, 'mensaje': mensaje, 'detalles': detalles}


def _normalizar(exc):
    """Convierte excepciones de Django/BD en equivalentes de DRF."""
    if isinstance(exc, Http404):
        return exceptions.NotFound()
    if isinstance(exc, PermissionDenied):
        return exceptions.PermissionDenied()
    if isinstance(exc, DjangoValidationError):
        detalle = exc.message_dict if hasattr(exc, 'error_dict') else {'non_field_errors': exc.messages}
        return exceptions.ValidationError(detalle)
    if isinstance(exc, IntegrityError):
        return Conflicto('La operación viola una restricción de integridad de los datos.')
    return exc


def custom_exception_handler(exc, context):
    exc = _normalizar(exc)
    response = exception_handler(exc, context)
    if response is None:
        vista = context.get('view').__class__.__name__ if context.get('view') else 'desconocida'
        logger.error('Error no controlado en la vista %s', vista, exc_info=exc)
        codigo = status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response(_formatear(codigo, MENSAJES_POR_CODIGO[codigo]), status=codigo)

    codigo = response.status_code
    datos = response.data
    if isinstance(exc, exceptions.ValidationError):
        mensaje = MENSAJES_POR_CODIGO[status.HTTP_400_BAD_REQUEST]
        detalles = datos
    elif isinstance(datos, dict) and 'detail' in datos:
        mensaje = str(datos['detail'])
        detalles = {k: v for k, v in datos.items() if k != 'detail'} or None
    else:
        mensaje = MENSAJES_POR_CODIGO.get(codigo, 'Ocurrió un error al procesar la solicitud.')
        detalles = datos

    if codigo >= 500:
        logger.error('Error %s: %s', codigo, mensaje)
    response.data = _formatear(codigo, mensaje, detalles)
    return response
