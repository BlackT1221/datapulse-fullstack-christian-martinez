import logging

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.test import RequestFactory
from django.urls import reverse

from apps.core.auditoria import obtener_ip, registrar_actividad
from apps.core.exceptions import custom_exception_handler
from apps.core.models import LogActividad


@pytest.fixture
def logs_apps(monkeypatch):
    # El logger "apps" no propaga a root en settings; se habilita para que caplog lo capture.
    monkeypatch.setattr(logging.getLogger('apps'), 'propagate', True)


def test_middleware_registra_request(api_client, db, caplog, logs_apps):
    with caplog.at_level(logging.INFO, logger='apps.core.requests'):
        api_client.get(reverse('auth-me'))
    registro = next(r for r in caplog.records if r.name == 'apps.core.requests')
    assert registro.metodo == 'GET'
    assert registro.path == '/api/auth/me/'
    assert registro.status_code == 401
    assert registro.usuario == 'anonimo'
    assert registro.duracion_ms >= 0


def test_middleware_identifica_usuario_jwt(api_client, analista, caplog, logs_apps):
    api_client.force_authenticate(analista)
    with caplog.at_level(logging.INFO, logger='apps.core.requests'):
        api_client.get(reverse('auth-me'))
    registro = next(r for r in caplog.records if r.name == 'apps.core.requests')
    assert registro.usuario == 'analista@test.com'


def test_exception_handler_convierte_validation_error_de_django():
    respuesta = custom_exception_handler(DjangoValidationError({'nombre': ['Inválido.']}), {})
    assert respuesta.status_code == 400
    assert respuesta.data == {
        'error': True, 'codigo': 400, 'mensaje': 'La solicitud contiene datos inválidos.',
        'detalles': {'nombre': ['Inválido.']},
    }


def test_exception_handler_integrity_error_es_409():
    respuesta = custom_exception_handler(IntegrityError('duplicado'), {})
    assert respuesta.status_code == 409
    assert respuesta.data['error'] is True


def test_exception_handler_error_no_controlado_es_500():
    respuesta = custom_exception_handler(RuntimeError('boom'), {})
    assert respuesta.status_code == 500
    assert respuesta.data['mensaje'] == 'Error interno del servidor.'


def test_obtener_ip_prefiere_x_forwarded_for():
    request = RequestFactory().get('/', HTTP_X_FORWARDED_FOR='203.0.113.7, 10.0.0.1')
    assert obtener_ip(request) == '203.0.113.7'


def test_registrar_actividad_con_instancia(colombia, analista):
    request = RequestFactory().get('/')
    request.user = analista
    log = registrar_actividad(request, LogActividad.Accion.CONSULTAR, colombia, detalle={'x': 1})
    assert (log.usuario, log.entidad_afectada, log.entidad_id) == (analista, 'Pais', 'CO')


def test_registrar_actividad_no_rompe_si_falla(colombia, monkeypatch):
    def fallar(**kwargs):
        raise RuntimeError('BD caída')

    monkeypatch.setattr(LogActividad.objects, 'create', fallar)
    assert registrar_actividad(None, LogActividad.Accion.CREAR, colombia) is None
