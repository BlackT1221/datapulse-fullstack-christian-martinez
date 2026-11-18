"""Tests de los clientes externos: tolerancia a fallos de red y datos nulos (SPEC §7, escenario 1)."""
import datetime
import logging
from decimal import Decimal
from unittest import mock

import pytest
import requests

from apps.countries import services
from apps.countries.models import IndicadorEconomico, Pais, TipoCambio
from apps.risk.models import Alerta


def _respuesta(datos):
    respuesta = mock.Mock()
    respuesta.json.return_value = datos
    respuesta.raise_for_status.return_value = None
    return respuesta


@pytest.fixture
def brasil(db):
    return Pais.objects.create(
        codigo_iso='BR', nombre='Brasil', moneda_codigo='BRL', moneda_nombre='Real brasileño',
        region=Pais.Region.CONO_SUR, latitud=Decimal('-14.2350'), longitud=Decimal('-51.9253'),
    )


@pytest.fixture
def logs_apps(monkeypatch, caplog):
    """El logger `apps` no propaga a root en settings; se habilita para que caplog lo capture."""
    monkeypatch.setattr(logging.getLogger('apps'), 'propagate', True)
    caplog.set_level(logging.ERROR, logger='apps')
    return caplog


def test_get_json_usa_timeout_de_10_segundos():
    with mock.patch.object(services.requests, 'get', return_value=_respuesta({'ok': 1})) as get:
        assert services._get_json('https://ejemplo.test') == {'ok': 1}
    assert get.call_args.kwargs['timeout'] == 10


def test_get_json_devuelve_none_ante_timeout():
    with mock.patch.object(services.requests, 'get', side_effect=requests.Timeout('lento')):
        assert services._get_json('https://ejemplo.test') is None


def test_world_bank_omite_valores_nulos():
    datos = [{'page': 1}, [{'date': '2023', 'value': 9.2}, {'date': '2022', 'value': None}]]
    with mock.patch.object(services.requests, 'get', return_value=_respuesta(datos)):
        assert services.obtener_indicador_world_bank('CO', 'FP.CPI.TOTL.ZG', 2022, 2023) == {
            2023: Decimal('9.2'),
        }


def test_world_bank_formato_de_error_devuelve_none():
    with mock.patch.object(services.requests, 'get', return_value=_respuesta([{'message': 'invalid'}])):
        assert services.obtener_indicador_world_bank('XX', 'NY.GDP.MKTP.CD', 2022, 2023) is None


def test_sincronizacion_continua_si_un_pais_falla(colombia, brasil, logs_apps):
    def get_simulado(url, params=None, timeout=None):
        if '/country/BR/' in url:
            raise requests.ConnectionError('World Bank caído')
        return _respuesta([{'page': 1}, [{'date': '2023', 'value': 60.5}]])

    with mock.patch.object(services.requests, 'get', side_effect=get_simulado):
        resultado = services.sincronizar_indicadores(anio_inicio=2023, anio_fin=2023)

    assert resultado.procesados == 2
    assert IndicadorEconomico.objects.filter(pais=colombia).count() == 6
    assert not IndicadorEconomico.objects.filter(pais=brasil).exists()
    assert len(resultado.errores) == 6 and all(e['contexto'].startswith('BR/') for e in resultado.errores)
    assert 'World Bank caído' in logs_apps.text
    # Regla 4 (INFO) y regla 5 (inflación 60.5 % > 50 → CRITICAL) solo para Colombia.
    assert set(Alerta.objects.values_list('pais_id', 'severidad')) == {('CO', 'INFO'), ('CO', 'CRITICAL')}


def test_sincronizacion_repetida_sin_cambios_no_genera_alertas_nuevas(colombia):
    datos = [{'page': 1}, [{'date': '2023', 'value': 4.0}]]
    with mock.patch.object(services.requests, 'get', return_value=_respuesta(datos)):
        services.sincronizar_indicadores(anio_inicio=2023, anio_fin=2023)
        Alerta.objects.update(leida=True)
        segundo = services.sincronizar_indicadores(anio_inicio=2023, anio_fin=2023)
    assert segundo.actualizados == 0
    assert not Alerta.objects.filter(leida=False).exists()


def test_tipo_cambio_calcula_variacion_y_alerta(colombia, brasil, logs_apps):
    hoy = datetime.date(2026, 11, 18)
    TipoCambio.objects.create(
        moneda_origen=colombia, fecha=hoy - datetime.timedelta(days=1), tasa=Decimal('4000'),
    )
    datos = {'base': 'USD', 'rates': {'COP': 4160.0}}  # BRL ausente
    with mock.patch.object(services.requests, 'get', return_value=_respuesta(datos)):
        resultado = services.actualizar_tipos_cambio(fecha=hoy)

    hoy_co = TipoCambio.objects.get(moneda_origen=colombia, fecha=hoy)
    assert hoy_co.variacion_porcentual == Decimal('4.0000')
    assert Alerta.objects.filter(pais=colombia, tipo_alerta='TIPO_CAMBIO', severidad='WARNING').exists()
    assert resultado.errores == [{'contexto': 'BRL', 'mensaje': 'Tasa no disponible en la respuesta.'}]
    assert 'BRL' in logs_apps.text


def test_tipo_cambio_api_caida_no_lanza_excepcion(colombia):
    with mock.patch.object(services.requests, 'get', side_effect=requests.ConnectionError('caída')):
        resultado = services.actualizar_tipos_cambio()
    assert resultado.procesados == 0 and resultado.errores
    assert not TipoCambio.objects.exists()


def test_rest_countries_actualiza_poblacion_y_bandera(colombia, brasil):
    def get_simulado(url, params=None, timeout=None):
        if url.endswith('/BR'):
            raise requests.Timeout('lento')
        return _respuesta([{
            'name': {'official': 'Republic of Colombia'}, 'currencies': {'COP': {}},
            'population': 50_882_884, 'latlng': [4.0, -72.0],
            'flags': {'png': 'https://flagcdn.com/w320/co.png'},
        }])

    with mock.patch.object(services.requests, 'get', side_effect=get_simulado):
        resultado = services.actualizar_datos_paises()

    colombia.refresh_from_db()
    assert colombia.poblacion == 50_882_884
    assert colombia.bandera_url == 'https://flagcdn.com/w320/co.png'
    assert colombia.latitud == Decimal('4.5709')  # las coordenadas del catálogo no se sobrescriben
    assert [e['contexto'] for e in resultado.errores] == ['BR']
