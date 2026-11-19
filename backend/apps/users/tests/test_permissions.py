import pytest
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.portfolios.models import Portafolio
from apps.users.permissions import (
    EsAdmin, EsAnalista, EsPropietarioOPublico, EsViewer, PuedeEditarPortafolios,
)

factory = APIRequestFactory()


@api_view(['GET', 'POST', 'PUT', 'DELETE'])
@permission_classes([PuedeEditarPortafolios])
def vista_portafolios(request):
    return Response({'ok': True})


def _llamar(metodo, usuario=None):
    request = getattr(factory, metodo)('/api/portafolios/', {}, format='json')
    if usuario is not None:
        force_authenticate(request, user=usuario)
    return vista_portafolios(request)


@pytest.mark.parametrize('metodo', ['post', 'put', 'delete'])
def test_viewer_recibe_403_al_escribir_portafolios(viewer, metodo):
    respuesta = _llamar(metodo, viewer)
    assert respuesta.status_code == 403
    assert respuesta.data['mensaje'] == 'Los usuarios con rol VIEWER no pueden crear ni editar portafolios.'


def test_viewer_puede_leer_portafolios(viewer):
    assert _llamar('get', viewer).status_code == 200


@pytest.mark.parametrize('rol_fixture', ['analista', 'administrador'])
def test_analista_y_admin_pueden_escribir(request, rol_fixture):
    assert _llamar('post', request.getfixturevalue(rol_fixture)).status_code == 200


def test_anonimo_recibe_401(db):
    assert _llamar('get').status_code == 401


def _req(metodo, usuario):
    request = getattr(factory, metodo)('/')
    request.user = usuario
    return request


def test_permisos_por_rol(administrador, analista, viewer):
    assert EsAdmin().has_permission(_req('post', administrador), None)
    assert not EsAdmin().has_permission(_req('post', analista), None)
    assert EsAnalista().has_permission(_req('post', analista), None)
    assert not EsAnalista().has_permission(_req('post', viewer), None)
    assert EsViewer().has_permission(_req('get', viewer), None)
    assert not EsViewer().has_permission(_req('post', viewer), None)


def test_propietario_o_publico(administrador, analista, viewer):
    privado = Portafolio.objects.create(nombre='Privado', usuario=analista)
    publico = Portafolio.objects.create(nombre='Público', usuario=analista, es_publico=True)
    permiso = EsPropietarioOPublico()

    assert permiso.has_object_permission(_req('put', analista), None, privado)
    assert permiso.has_object_permission(_req('put', administrador), None, privado)
    assert not permiso.has_object_permission(_req('get', viewer), None, privado)
    assert permiso.has_object_permission(_req('get', viewer), None, publico)
    assert not permiso.has_object_permission(_req('put', viewer), None, publico)
