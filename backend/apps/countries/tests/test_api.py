"""API de países: paginación, filtros, búsqueda, orden y sincronización (solo ADMIN)."""
from unittest import mock

import pytest
import requests
from django.contrib.auth import get_user_model

from apps.countries import services
from apps.risk.models import IndiceRiesgo

pytestmark = pytest.mark.django_db
URL = '/api/paises/'


@pytest.fixture
def api(cliente, datos_seed):
    return cliente(get_user_model().objects.get(email='viewer@datapulse.com'))


def test_listado_paginado_con_irpc(api):
    cuerpo = api.get(URL).json()
    assert cuerpo['count'] == 10 and len(cuerpo['results']) == 10
    argentina = next(p for p in cuerpo['results'] if p['codigo_iso'] == 'AR')
    assert (argentina['nivel_riesgo'], argentina['color_riesgo']) == ('ALTO', '#f97316')
    pagina = api.get(URL, {'page_size': 3}).json()
    assert len(pagina['results']) == 3 and pagina['next']


def test_filtro_region_busqueda_y_orden(api):
    andinos = api.get(URL, {'region': 'ANDINA'}).json()['results']
    assert {p['codigo_iso'] for p in andinos} == {'CO', 'PE', 'EC'}
    assert [p['codigo_iso'] for p in api.get(URL, {'search': 'argen'}).json()['results']] == ['AR']
    assert api.get(URL, {'search': 'COP'}).json()['results'][0]['codigo_iso'] == 'CO'
    por_riesgo = api.get(URL, {'ordering': 'irpc'}).json()['results']
    assert [p['codigo_iso'] for p in por_riesgo[:2]] == ['AR', 'BR']


def test_region_invalida_es_400_en_espanol(api):
    respuesta = api.get(URL, {'region': 'EUROPA'})
    assert respuesta.status_code == 400
    assert 'region' in respuesta.json()['detalles']


def test_detalle_acepta_minusculas_e_incluye_indicadores(api):
    cuerpo = api.get(f'{URL}co/').json()
    assert cuerpo['codigo_iso'] == 'CO' and cuerpo['irpc'] == '75.00'
    assert {i['tipo'] for i in cuerpo['indicadores_actuales']} == {
        'PIB', 'INFLACION', 'DESEMPLEO', 'BALANZA_COMERCIAL', 'DEUDA_PIB', 'PIB_PERCAPITA'}
    assert all(i['anio'] == 2023 for i in cuerpo['indicadores_actuales'])
    assert cuerpo['tipo_cambio_actual']['moneda_origen'] == 'COP'
    assert api.get(f'{URL}XX/').status_code == 404


def test_indicadores_con_filtros_y_orden(api):
    assert api.get(f'{URL}CO/indicadores/', {'tipo': 'INFLACION'}).json()['count'] == 3
    assert api.get(f'{URL}CO/indicadores/', {'anio': 2023}).json()['count'] == 6
    filas = api.get(f'{URL}CO/indicadores/', {'tipo': 'PIB', 'ordering': 'anio'}).json()['results']
    assert [f['anio'] for f in filas] == [2021, 2022, 2023]
    invalido = api.get(f'{URL}CO/indicadores/', {'ordering': 'clave'})
    assert invalido.status_code == 400 and 'ordering' in invalido.json()['detalles']


def test_tipo_cambio_con_rango_de_fechas(api):
    serie = api.get(f'{URL}CO/tipo-cambio/', {'page_size': 50}).json()
    assert serie['count'] == 30
    fechas = [f['fecha'] for f in serie['results']]
    assert fechas == sorted(fechas, reverse=True)
    desde = fechas[9]
    assert api.get(f'{URL}CO/tipo-cambio/', {'fecha_desde': desde}).json()['count'] == 10


def test_sync_solo_admin(cliente, datos_seed):
    for email in ('viewer@datapulse.com', 'analista@datapulse.com'):
        usuario = get_user_model().objects.get(email=email)
        respuesta = cliente(usuario).post(f'{URL}sync-indicadores/')
        assert respuesta.status_code == 403
        assert respuesta.json()['mensaje'] == 'Esta acción requiere rol ADMIN.'


def test_sync_con_apis_caidas_continua_y_recalcula(cliente, datos_seed):
    """SPEC §7 escenario 1: sin APIs externas la sincronización no falla y reporta errores."""
    admin = get_user_model().objects.get(email='admin@datapulse.com')
    with mock.patch.object(services.requests, 'get', side_effect=requests.ConnectionError('sin red')):
        respuesta = cliente(admin).post(f'{URL}sync-indicadores/')
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo['indicadores']['procesados'] == 10
    assert len(cuerpo['indicadores']['errores']) == 60
    assert cuerpo['tipos_cambio']['errores'][0]['contexto'] == 'EXCHANGE_RATE_API'
    assert cuerpo['irpc'] == {'calculados': 10, 'errores': []}
    assert IndiceRiesgo.objects.count() == 20
