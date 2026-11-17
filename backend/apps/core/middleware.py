"""Middleware de logging estructurado de requests (método, path, usuario, estado y duración)."""
import logging
import time

logger = logging.getLogger('apps.core.requests')


class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        inicio = time.perf_counter()
        try:
            response = self.get_response(request)
        except Exception:
            self._registrar(request, 500, inicio, nivel=logging.ERROR)
            raise
        nivel = logging.ERROR if response.status_code >= 500 else logging.INFO
        self._registrar(request, response.status_code, inicio, nivel=nivel)
        return response

    @staticmethod
    def _registrar(request, status_code, inicio, nivel):
        duracion_ms = round((time.perf_counter() - inicio) * 1000, 2)
        # DRF asigna el usuario autenticado por JWT a la HttpRequest original durante la vista.
        usuario = getattr(request, 'user', None)
        autenticado = usuario is not None and usuario.is_authenticated
        identificador = usuario.get_username() if autenticado else 'anonimo'
        logger.log(
            nivel,
            '%s %s %s %sms usuario=%s',
            request.method, request.get_full_path(), status_code, duracion_ms, identificador,
            extra={
                'metodo': request.method,
                'path': request.path,
                'status_code': status_code,
                'duracion_ms': duracion_ms,
                'usuario': identificador,
            },
        )
