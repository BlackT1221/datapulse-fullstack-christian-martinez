"""Posiciones: validaciones cruzadas (SPEC §5.3), cierre, resumen y exportación PDF/XLSX."""
import datetime
import io
from decimal import Decimal

import pytest
from openpyxl import load_workbook

from apps.core.models import LogActividad
from apps.portfolios.models import Portafolio
from apps.risk.models import IndiceRiesgo

from .test_api import HACE_UN_MES, HOY, crear_posicion, datos_posicion, url_detalle, url_posiciones


@pytest.fixture
def portafolio(analista):
    return Portafolio.objects.create(usuario=analista, nombre='Cono Sur', es_publico=False)


@pytest.fixture
def api(cliente, analista):
    return cliente(analista)


def errores(respuesta):
    assert respuesta.status_code == 400, respuesta.json()
    cuerpo = respuesta.json()
    assert cuerpo['error'] is True and cuerpo['codigo'] == 400
    return cuerpo['detalles']


@pytest.mark.django_db
class TestValidacionesCruzadas:
    def test_moneda_prohibida_en_pais_dolarizado(self, api, portafolio, ecuador):
        respuesta = api.post(url_posiciones(portafolio), datos_posicion('EC', 'MONEDA'), format='json')
        detalles = errores(respuesta)
        assert detalles['tipo_activo'] == [
            'No se permite el tipo de activo MONEDA para Ecuador: su moneda es el dólar estadounidense (USD).'
        ]

    def test_moneda_permitida_en_pais_no_dolarizado(self, api, portafolio, colombia):
        respuesta = api.post(url_posiciones(portafolio), datos_posicion('CO', 'MONEDA'), format='json')
        assert respuesta.status_code == 201

    def test_otros_activos_permitidos_en_ecuador(self, api, portafolio, ecuador):
        respuesta = api.post(url_posiciones(portafolio), datos_posicion('EC', 'COMMODITIES'), format='json')
        assert respuesta.status_code == 201

    def test_monto_activo_total_no_supera_50_millones(self, api, portafolio, colombia, brasil):
        for pais, tipo in ((colombia, 'RENTA_FIJA'), (colombia, 'RENTA_VARIABLE'), (brasil, 'RENTA_FIJA'),
                           (brasil, 'RENTA_VARIABLE')):
            crear_posicion(portafolio, pais, tipo, '10000000')
        crear_posicion(portafolio, brasil, 'COMMODITIES', '9500000')  # activo: 49,500,000
        crear_posicion(portafolio, colombia, 'COMMODITIES', '5000000', salida=HOY)  # cerrada: no cuenta

        datos = datos_posicion('CO', 'MONEDA', '500000.01')
        exceso = api.post(url_posiciones(portafolio), datos, format='json')
        assert errores(exceso)['monto_inversion_usd'] == [
            'El monto activo total del portafolio no puede superar $50,000,000.00 USD. '
            'Monto activo actual: $49,500,000.00 USD; disponible: $500,000.00 USD.'
        ]
        justo = api.post(url_posiciones(portafolio), datos_posicion('CO', 'MONEDA', '500000'), format='json')
        assert justo.status_code == 201

    def test_editar_posicion_no_se_cuenta_dos_veces(self, api, portafolio, colombia, brasil):
        for pais, tipo in ((colombia, 'RENTA_FIJA'), (colombia, 'RENTA_VARIABLE'), (brasil, 'RENTA_FIJA'),
                           (brasil, 'RENTA_VARIABLE')):
            crear_posicion(portafolio, pais, tipo, '10000000')
        editable = crear_posicion(portafolio, brasil, 'COMMODITIES', '9000000')
        datos = datos_posicion('BR', 'COMMODITIES', '10000000')  # 40M + 10M = 50M exactos
        assert api.put(url_posiciones(portafolio, editable), datos, format='json').status_code == 200

    def test_maximo_dos_posiciones_activas_iguales_por_pais(self, api, portafolio, colombia, brasil):
        crear_posicion(portafolio, colombia, 'RENTA_FIJA')
        crear_posicion(portafolio, colombia, 'RENTA_FIJA')
        crear_posicion(portafolio, colombia, 'RENTA_FIJA', salida=HOY)  # cerrada: no cuenta
        tercera = api.post(url_posiciones(portafolio), datos_posicion('CO', 'RENTA_FIJA'), format='json')
        assert errores(tercera)['non_field_errors'] == [
            'Ya existen 2 posiciones activas de Renta fija en Colombia; es el máximo permitido.'
        ]
        assert api.post(url_posiciones(portafolio), datos_posicion('BR', 'RENTA_FIJA'), format='json') \
            .status_code == 201
        assert api.post(url_posiciones(portafolio), datos_posicion('CO', 'RENTA_VARIABLE'), format='json') \
            .status_code == 201

    @pytest.mark.parametrize('extra, campo, mensaje', [
        ({'monto_inversion_usd': '999.99'}, 'monto_inversion_usd',
         'El monto mínimo por posición es $1,000.00 USD.'),
        ({'monto_inversion_usd': '10000000.01'}, 'monto_inversion_usd',
         'El monto máximo por posición es $10,000,000.00 USD.'),
        ({'fecha_entrada': (HOY + datetime.timedelta(days=1)).isoformat()}, 'fecha_entrada',
         'La fecha de entrada no puede ser futura.'),
        ({'notas': 'x' * 201}, 'notas', 'Las notas no pueden superar los 200 caracteres.'),
        ({'fecha_salida': HACE_UN_MES.isoformat()}, 'fecha_salida',
         'La fecha de salida debe ser posterior a la fecha de entrada.'),
        ({'pais': 'ZZ'}, 'pais', 'El país "ZZ" no existe o no está activo.'),
    ])
    def test_validaciones_de_campo(self, api, portafolio, colombia, extra, campo, mensaje):
        datos = datos_posicion()
        datos.update(extra)
        assert errores(api.post(url_posiciones(portafolio), datos, format='json'))[campo] == [mensaje]


@pytest.mark.django_db
class TestCierreDePosicion:
    def test_delete_cierra_con_fecha_de_hoy(self, api, portafolio, colombia):
        posicion = crear_posicion(portafolio, colombia)
        respuesta = api.delete(url_posiciones(portafolio, posicion))
        assert respuesta.status_code == 200
        assert respuesta.json()['fecha_salida'] == HOY.isoformat()
        assert respuesta.json()['esta_activa'] is False
        posicion.refresh_from_db()
        assert posicion.fecha_salida == HOY
        assert LogActividad.objects.filter(accion='ELIMINAR', entidad_afectada='Posicion').exists()

    def test_no_cierra_dos_veces(self, api, portafolio, colombia):
        posicion = crear_posicion(portafolio, colombia, salida=HOY)
        assert errores(api.delete(url_posiciones(portafolio, posicion)))['fecha_salida'] == [
            'La posición ya está cerrada.'
        ]

    def test_no_cierra_el_mismo_dia_de_entrada(self, api, portafolio, colombia):
        posicion = crear_posicion(portafolio, colombia)
        posicion.fecha_entrada = HOY
        posicion.save()
        assert 'fecha_salida' in errores(api.delete(url_posiciones(portafolio, posicion)))

    def test_filtro_por_posiciones_activas(self, api, portafolio, colombia):
        crear_posicion(portafolio, colombia)
        crear_posicion(portafolio, colombia, salida=HOY)
        assert api.get(url_posiciones(portafolio), {'activa': 'true'}).json()['count'] == 1


@pytest.mark.django_db
def test_resumen_con_riesgo_ponderado(api, portafolio, colombia, brasil):
    for pais, irpc in ((colombia, '80'), (brasil, '40')):
        IndiceRiesgo.objects.create(
            pais=pais, score_economico=irpc, score_cambiario=irpc, score_estabilidad=irpc,
            indice_compuesto=Decimal(irpc), nivel_riesgo='BAJO',
        )
    crear_posicion(portafolio, colombia, 'RENTA_FIJA', '3000000')
    crear_posicion(portafolio, brasil, 'RENTA_VARIABLE', '1000000')
    crear_posicion(portafolio, brasil, 'RENTA_FIJA', '5000000', salida=HOY)

    resumen = api.get(f'{url_detalle(portafolio)}resumen/').json()
    assert resumen['monto_total_activo'] == 4_000_000
    assert resumen['riesgo_promedio_ponderado'] == 70.0  # (3M × 80 + 1M × 40) / 4M
    assert resumen['nivel_riesgo'] == 'MODERADO'
    distribucion = [(f['pais'], f['porcentaje']) for f in resumen['distribucion_pais']]
    assert distribucion == [('CO', 75.0), ('BR', 25.0)]
    assert {f['tipo_activo'] for f in resumen['distribucion_tipo_activo']} == {'RENTA_FIJA', 'RENTA_VARIABLE'}

    detalle = api.get(url_detalle(portafolio)).json()
    assert len(detalle['posiciones']) == 3
    assert detalle['metricas']['riesgo_promedio_ponderado'] == 70.0


@pytest.mark.django_db
class TestExportacion:
    def test_pdf_con_graficos(self, api, portafolio, colombia, brasil):
        crear_posicion(portafolio, colombia)
        crear_posicion(portafolio, brasil, 'RENTA_VARIABLE')
        respuesta = api.get(f'{url_detalle(portafolio)}export/pdf/', HTTP_ACCEPT='application/pdf')
        assert respuesta.status_code == 200
        assert respuesta['Content-Type'] == 'application/pdf'
        assert respuesta['Content-Disposition'].startswith('attachment; filename="portafolio-cono-sur-')
        assert respuesta.content.startswith(b'%PDF')
        assert LogActividad.objects.filter(accion='EXPORT', detalle__formato='pdf').exists()

    def test_pdf_sin_posiciones(self, api, portafolio):
        assert api.get(f'{url_detalle(portafolio)}export/pdf/').content.startswith(b'%PDF')

    def test_xlsx_con_hojas_y_datos(self, api, portafolio, colombia):
        crear_posicion(portafolio, colombia, monto='2500000')
        respuesta = api.get(f'{url_detalle(portafolio)}export/xlsx/')
        assert respuesta.status_code == 200
        assert respuesta['Content-Type'].startswith('application/vnd.openxmlformats')
        libro = load_workbook(io.BytesIO(respuesta.content))
        assert libro.sheetnames == ['Resumen', 'Posiciones', 'Por país', 'Por tipo de activo']
        assert libro['Posiciones']['A2'].value == 'Colombia'
        assert libro['Posiciones']['C2'].value == 2_500_000
        assert len(libro['Por país']._charts) == 1

    def test_exportar_privado_ajeno_es_404(self, cliente, otro_analista, portafolio):
        respuesta = cliente(otro_analista).get(f'{url_detalle(portafolio)}export/pdf/',
                                               HTTP_ACCEPT='application/pdf')
        assert respuesta.status_code == 404
        assert respuesta.json()['codigo'] == 404
