"""API de riesgo (ranking, detalle, histórico, recálculo) y de alertas."""
import pytest
from django.contrib.auth import get_user_model

from apps.risk.models import Alerta, IndiceRiesgo

pytestmark = pytest.mark.django_db


def usuario(email):
    return get_user_model().objects.get(email=email)


@pytest.fixture
def api(cliente, datos_seed):
    return cliente(usuario('analista@datapulse.com'))


def test_ranking_ordenado_por_irpc(api):
    cuerpo = api.get('/api/riesgo/').json()
    assert cuerpo['count'] == 10
    filas = cuerpo['results']
    assert [f['posicion'] for f in filas] == list(range(1, 11))
    irpc = [float(f['indice_compuesto']) for f in filas]
    assert irpc == sorted(irpc, reverse=True)
    assert filas[-1]['pais'] == 'AR' and filas[-1]['color'] == '#f97316'
    assert filas[0]['variacion'] is None and filas[0]['tendencia'] is None  # sin cálculo anterior


def test_ranking_filtros_y_orden(api):
    assert [f['pais'] for f in api.get('/api/riesgo/', {'nivel_riesgo': 'ALTO'}).json()['results']] == ['AR']
    inverso = api.get('/api/riesgo/', {'ordering': 'indice_compuesto'}).json()['results']
    assert inverso[0]['pais'] == 'AR' and inverso[0]['posicion'] == 10
    assert api.get('/api/riesgo/', {'region': 'CENTROAMERICA'}).json()['count'] == 2


def test_variacion_y_tendencia_tras_recalculo(cliente, api):
    cliente(usuario('admin@datapulse.com')).post('/api/riesgo/calcular/')
    fila = api.get('/api/riesgo/').json()['results'][0]
    assert fila['variacion'] == 0.0 and fila['tendencia'] == 'ESTABLE'


def test_detalle_e_historico(api):
    detalle = api.get('/api/riesgo/ar/').json()
    assert detalle['pais'] == 'AR' and detalle['nivel_riesgo'] == 'ALTO'
    assert detalle['detalle_calculo']['penalizaciones']['INFLACION'] == 40
    assert len(detalle['historico']) == 1
    historico = api.get('/api/riesgo/AR/historico/').json()
    assert historico['count'] == 1 and 'detalle_calculo' not in historico['results'][0]
    assert api.get('/api/riesgo/AR/historico/', {'fecha_desde': '2999-01-01'}).json()['count'] == 0
    assert api.get('/api/riesgo/XX/').status_code == 404


def test_calcular_solo_admin(cliente, api):
    assert api.post('/api/riesgo/calcular/').status_code == 403
    respuesta = cliente(usuario('admin@datapulse.com')).post('/api/riesgo/calcular/')
    assert respuesta.status_code == 200
    assert respuesta.json()['calculados'] == 10 and len(respuesta.json()['ranking']) == 10
    assert IndiceRiesgo.objects.count() == 20


class TestAlertas:
    def test_listado_con_filtros(self, api):
        assert api.get('/api/alertas/').json()['count'] == Alerta.objects.count() == 8
        cambiarias = api.get('/api/alertas/', {'tipo': 'TIPO_CAMBIO', 'severidad': 'WARNING'}).json()
        assert cambiarias['count'] == 7
        criticas = api.get('/api/alertas/', {'severidad': 'CRITICAL'}).json()['results']
        assert criticas[0]['pais'] == 'AR' and criticas[0]['es_global'] is True
        assert api.get('/api/alertas/', {'leida': 'true'}).json()['count'] == 0

    def test_alertas_personales_no_son_visibles_para_otros(self, cliente, api):
        viewer = usuario('viewer@datapulse.com')
        Alerta.objects.create(usuario=viewer, pais_id='CO', tipo_alerta='RIESGO', severidad='INFO',
                              titulo='Privada', mensaje='Solo para el viewer')
        assert cliente(viewer).get('/api/alertas/').json()['count'] == 9
        assert api.get('/api/alertas/').json()['count'] == 8

    def test_marcar_leida_y_leer_todas(self, cliente, datos_seed):
        api = cliente(usuario('viewer@datapulse.com'))  # leer alertas no requiere permisos de escritura
        alerta = Alerta.objects.first()
        respuesta = api.put(f'/api/alertas/{alerta.pk}/leer/')
        assert respuesta.status_code == 200 and respuesta.json()['leida'] is True
        assert api.put('/api/alertas/leer-todas/').json() == {'actualizadas': 7}
        assert not Alerta.objects.filter(leida=False).exists()

    def test_resumen(self, api):
        resumen = api.get('/api/alertas/resumen/').json()
        assert resumen['total'] == resumen['no_leidas'] == 8
        assert resumen['por_tipo'] == {'RIESGO': 0, 'TIPO_CAMBIO': 7, 'INDICADOR': 1}
        assert resumen['por_severidad'] == {'INFO': 0, 'WARNING': 7, 'CRITICAL': 1}
