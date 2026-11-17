import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def client_api():
    return APIClient()


@pytest.mark.django_db
def test_schema_openapi_disponible(client_api):
    respuesta = client_api.get(reverse('schema'))
    assert respuesta.status_code == 200


@pytest.mark.django_db
def test_token_con_credenciales_invalidas_usa_formato_estandar(client_api):
    respuesta = client_api.post(
        reverse('token_obtain_pair'),
        {'email': 'nadie@datapulse.com', 'password': 'incorrecta'},
        format='json',
    )
    assert respuesta.status_code == 401
    cuerpo = respuesta.json()
    assert cuerpo['error'] is True
    assert cuerpo['codigo'] == 401
    assert isinstance(cuerpo['mensaje'], str)
    assert 'detalles' in cuerpo


@pytest.mark.django_db
def test_validacion_devuelve_detalles(client_api):
    respuesta = client_api.post(reverse('token_obtain_pair'), {}, format='json')
    cuerpo = respuesta.json()
    assert respuesta.status_code == 400
    assert cuerpo['mensaje'] == 'La solicitud contiene datos inválidos.'
    assert 'email' in cuerpo['detalles']
