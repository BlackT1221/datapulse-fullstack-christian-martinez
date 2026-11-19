"""
Renderers para descargas binarias: permiten que la negociación de contenido acepte
`Accept: application/pdf` / `.xlsx`. Las respuestas de error se fuerzan a JSON en
`RespuestasErrorJsonMixin` para no enviar JSON etiquetado como PDF.
"""
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response


class ArchivoRenderer(BaseRenderer):
    charset = None
    render_style = 'binary'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class PdfRenderer(ArchivoRenderer):
    media_type = 'application/pdf'
    format = 'pdf'


class XlsxRenderer(ArchivoRenderer):
    media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    format = 'xlsx'


class RespuestasErrorJsonMixin:
    """Las respuestas DRF (errores) de acciones de descarga se renderizan siempre como JSON."""

    def finalize_response(self, request, response, *args, **kwargs):
        if isinstance(response, Response) and isinstance(getattr(request, 'accepted_renderer', None),
                                                         ArchivoRenderer):
            request.accepted_renderer = JSONRenderer()
            request.accepted_media_type = JSONRenderer.media_type
        return super().finalize_response(request, response, *args, **kwargs)
