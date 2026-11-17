"""Manejador de excepciones con formato de error estandarizado en español."""
from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

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


def _formatear(codigo, mensaje, detalles=None):
    return {'error': True, 'codigo': codigo, 'mensaje': mensaje, 'detalles': detalles}


def custom_exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        codigo = status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response(_formatear(codigo, MENSAJES_POR_CODIGO[codigo]), status=codigo)

    codigo = response.status_code
    datos = response.data
    if isinstance(exc, exceptions.ValidationError):
        mensaje = MENSAJES_POR_CODIGO[status.HTTP_400_BAD_REQUEST]
        detalles = datos
    elif isinstance(datos, dict) and 'detail' in datos:
        mensaje = str(datos['detail'])
        detalles = None
    else:
        mensaje = MENSAJES_POR_CODIGO.get(codigo, 'Ocurrió un error al procesar la solicitud.')
        detalles = datos

    response.data = _formatear(codigo, mensaje, detalles)
    return response
