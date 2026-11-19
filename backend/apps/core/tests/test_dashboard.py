"""Endpoints de dashboard y throttling global."""
import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

pytestmark = pytest.mark.django_db


@pytest.fixture
def api(cliente, datos_seed):
    return cliente(get_user_model().objects.get(email='analista@datapulse.com'))


def test_resumen_kpis(api):
    cuerpo = api.get('/api/dashboard/resumen/').json()
    assert cuerpo['total_paises'] == 10
    assert cuerpo['alertas_activas'] == 8 and cuerpo['alertas_criticas'] == 1
    assert cuerpo['portafolios_usuario'] == 2
    assert 50 <= cuerpo['promedio_irpc'] <= 100
    assert cuerpo['distribucion_niveles'] == {'BAJO': 8, 'MODERADO': 1, 'ALTO': 1, 'CRITICO': 0}


def test_mapa_con_coordenadas_y_colores(api):
    cuerpo = api.get('/api/dashboard/mapa/').json()
    assert len(cuerpo['paises']) == 10 and len(cuerpo['leyenda']) == 4
    argentina = next(p for p in cuerpo['paises'] if p['codigo_iso'] == 'AR')
    assert argentina['latitud'] == -38.4161 and argentina['color'] == '#f97316'
    assert argentina['alertas_no_leidas'] == 6


def test_tendencias_ultimos_5_anios(api):
    cuerpo = api.get('/api/dashboard/tendencias/', {'tipo': 'inflacion', 'paises': 'CO,BR,AR'}).json()
    assert cuerpo['tipo'] == 'INFLACION' and cuerpo['unidad'] == 'PORCENTAJE'
    assert cuerpo['anios'] == [2019, 2020, 2021, 2022, 2023]
    series = {s['pais']: s['valores'] for s in cuerpo['series']}
    assert set(series) == {'CO', 'BR', 'AR'}
    assert series['AR'] == [None, None, 48.4, 72.4, 133.5]


@pytest.mark.parametrize('params, campo', [
    ({'tipo': 'PBI'}, 'tipo'), ({'paises': 'CO,XX'}, 'paises'), ({'anios': '0'}, 'anios'),
])
def test_tendencias_parametros_invalidos(api, params, campo):
    respuesta = api.get('/api/dashboard/tendencias/', params)
    assert respuesta.status_code == 400 and campo in respuesta.json()['detalles']


def test_dashboard_requiere_autenticacion(api_client, db):
    assert api_client.get('/api/dashboard/resumen/').status_code == 401


def test_throttling_anonimo_20_por_minuto(api_client, db):
    cache.clear()
    codigos = [api_client.post('/api/auth/login/', {'email': 'x@x.com', 'password': 'x'}).status_code
               for _ in range(21)]
    assert codigos[:20] == [401] * 20
    assert codigos[20] == 429


def test_throttling_autenticado_100_por_minuto(cliente, analista):
    cache.clear()
    api = cliente(analista)
    codigos = [api.get('/api/auth/me/').status_code for _ in range(101)]
    assert codigos[:100] == [200] * 100
    respuesta = api.get('/api/auth/me/')
    assert respuesta.status_code == 429
    assert respuesta.json()['codigo'] == 429
