"""
Tests del motor IRPC (SPEC §4) y de la generación automática de alertas (SPEC §4.5).

Nota sobre el caso de referencia §4.4: sus sub-scores (45 / 90 / 80) producen IRPC = 69 (MODERADO)
con la fórmula ponderada, pero asigna -25 a una inflación de 9.2 %, mientras que los tramos de §4.2
dan -10 (> 5). El motor aplica §4.2 literalmente, por lo que Colombia calculada desde sus datos
obtiene Score_Economico = 60 e IRPC = 75 (BAJO). Ambos hechos quedan verificados abajo.
"""
import datetime
from decimal import Decimal

import pytest

from apps.countries.models import IndicadorEconomico, Pais, TipoCambio
from apps.risk.irpc import calcular_scores, clasificar, componer_irpc, nivel_riesgo, penalizacion
from apps.risk.models import Alerta, IndiceRiesgo
from apps.risk.services import (
    calcular_irpc_pais, generar_alerta_tipo_cambio, generar_alertas_indicadores, recalcular_todos,
)

HOY = datetime.date(2026, 11, 18)

INDICADORES_COLOMBIA = {
    2022: {'PIB': 358.1e9, 'PIB_PERCAPITA': 6_640, 'INFLACION': 10.2, 'DESEMPLEO': 11.2,
           'BALANZA_COMERCIAL': -5.1, 'DEUDA_PIB': 58.0},
    2023: {'PIB': 363.5e9, 'PIB_PERCAPITA': 6_800, 'INFLACION': 9.2, 'DESEMPLEO': 11.3,
           'BALANZA_COMERCIAL': -4.2, 'DEUDA_PIB': 55.0},
}


def crear_indicadores(pais, por_anio):
    for anio, valores in por_anio.items():
        for tipo, valor in valores.items():
            IndicadorEconomico.objects.create(
                pais=pais, tipo=tipo, anio=anio, valor=Decimal(str(valor)),
                unidad='USD' if tipo in ('PIB', 'PIB_PERCAPITA') else 'PORCENTAJE',
            )


def crear_serie_cambio(pais, tasa_inicial, tasa_final, amplitud, dias=30):
    """Serie de `dias` días que termina en HOY; variaciones alternan ±amplitud."""
    for i in range(dias):
        tasa = tasa_inicial + (tasa_final - tasa_inicial) * i / (dias - 1)
        TipoCambio.objects.create(
            moneda_origen=pais, fecha=HOY - datetime.timedelta(days=dias - 1 - i),
            tasa=Decimal(str(round(tasa, 6))),
            variacion_porcentual=Decimal(str(amplitud if i % 2 else -amplitud)),
        )


@pytest.fixture
def colombia_completa(colombia):
    crear_indicadores(colombia, INDICADORES_COLOMBIA)
    crear_serie_cambio(colombia, 4000, 4060, 0.8)  # volatilidad ≈ 0.81, depreciación 1.5 %
    return colombia


@pytest.fixture
def pais_en_crisis(db):
    pais = Pais.objects.create(
        codigo_iso='AR', nombre='Argentina', moneda_codigo='ARS', moneda_nombre='Peso argentino',
        region=Pais.Region.CONO_SUR, latitud=Decimal('-38.4161'), longitud=Decimal('-63.6167'),
    )
    crear_indicadores(pais, {
        2022: {'PIB': 600e9},
        2023: {'PIB': 570e9, 'PIB_PERCAPITA': 2_500, 'INFLACION': 133.5, 'DESEMPLEO': 18.0,
               'BALANZA_COMERCIAL': -12.0, 'DEUDA_PIB': 90.0},
    })
    crear_serie_cambio(pais, 800, 920, 5.0)  # volatilidad > 3, depreciación 15 %
    return pais


# --- Fórmula y caso de referencia (SPEC §4.4) ----------------------------------------------------

def test_caso_referencia_colombia_irpc_69_moderado():
    irpc = componer_irpc(45, 90, 80)
    assert irpc == Decimal('69.00')
    assert clasificar(irpc) == ('MODERADO', '#eab308', 'Invertir con precaución')


@pytest.mark.parametrize('clave, valor, esperado', [
    ('PIB_PERCAPITA', 6_800, 5), ('DESEMPLEO', 11.3, 15), ('DEUDA_PIB', 55, 10),
    ('VOLATILIDAD', 0.8, 10), ('DEPRECIACION', 1.5, 0), ('BALANZA_COMERCIAL', -4.2, 5),
    ('CRECIMIENTO_PIB', 1.5, 0),
])
def test_penalizaciones_del_caso_referencia(clave, valor, esperado):
    assert penalizacion(clave, valor) == esperado


@pytest.mark.parametrize('valor, esperado', [(133.5, 40), (50.1, 40), (10.2, 25), (9.2, 10), (5, 0)])
def test_tramos_inflacion_segun_spec_4_2(valor, esperado):
    assert penalizacion('INFLACION', valor) == esperado


@pytest.mark.parametrize('indice, nivel', [
    (100, 'BAJO'), (75, 'BAJO'), (74.99, 'MODERADO'), (50, 'MODERADO'),
    (49.99, 'ALTO'), (25, 'ALTO'), (24.99, 'CRITICO'), (0, 'CRITICO'),
])
def test_escala_de_clasificacion(indice, nivel):
    assert nivel_riesgo(indice) == nivel


def test_scores_nunca_negativos():
    peor = {'PIB_PERCAPITA': 100, 'INFLACION': 500, 'DESEMPLEO': 40, 'DEUDA_PIB': 200,
            'VOLATILIDAD': 10, 'DEPRECIACION': 50, 'BALANZA_COMERCIAL': -30, 'CRECIMIENTO_PIB': -10}
    resultado = calcular_scores(peor)
    assert resultado['score_economico'] == 0
    assert resultado['indice_compuesto'] >= 0
    assert resultado['nivel_riesgo'] == 'CRITICO'


@pytest.mark.django_db
def test_colombia_desde_bd_aplica_spec_4_2(colombia_completa):
    indice = calcular_irpc_pais(colombia_completa)
    detalle = indice.detalle_calculo
    assert detalle['penalizaciones']['INFLACION'] == 10  # §4.4 indica -25; ver docstring del módulo.
    assert detalle['indicadores_negativos'] == 3
    assert indice.score_economico == Decimal('60')
    assert indice.score_cambiario == Decimal('90')
    assert indice.score_estabilidad == Decimal('80')
    assert indice.indice_compuesto == Decimal('75.00')
    assert indice.nivel_riesgo == 'BAJO'
    assert detalle['indicadores_faltantes'] == []
    assert detalle['datos_completos'] is True
    assert detalle['periodo']['indicadores']['CRECIMIENTO_PIB'] == '2022-2023'


# --- Datos incompletos (SPEC §7, escenario 4) -----------------------------------------------------

def test_calcular_scores_con_none_no_lanza_excepcion():
    resultado = calcular_scores({'INFLACION': None, 'DESEMPLEO': 12})
    assert resultado['score_economico'] == Decimal('85')
    assert 'INFLACION' in resultado['indicadores_faltantes']
    assert 'DESEMPLEO' not in resultado['indicadores_faltantes']


@pytest.mark.django_db
def test_irpc_con_datos_incompletos_registra_faltantes(colombia):
    crear_indicadores(colombia, {2023: {'INFLACION': 8.0, 'PIB': 363.5e9}})
    indice = calcular_irpc_pais(colombia)
    faltantes = indice.detalle_calculo['indicadores_faltantes']
    assert set(faltantes) == {
        'PIB_PERCAPITA', 'DESEMPLEO', 'DEUDA_PIB', 'BALANZA_COMERCIAL',
        'CRECIMIENTO_PIB', 'VOLATILIDAD', 'DEPRECIACION',
    }
    assert indice.detalle_calculo['datos_completos'] is False
    assert indice.score_economico == Decimal('90')
    assert indice.score_cambiario == Decimal('100')
    assert indice.score_estabilidad == Decimal('95')  # inflación -10 cuenta como indicador negativo
    assert indice.indice_compuesto == Decimal('94.50')


@pytest.mark.django_db
def test_irpc_sin_ningun_dato(colombia):
    indice = calcular_irpc_pais(colombia)
    assert indice.indice_compuesto == Decimal('100.00')
    assert len(indice.detalle_calculo['indicadores_faltantes']) == 8


@pytest.mark.django_db
def test_recalcular_todos_continua_si_un_pais_falla(colombia_completa, pais_en_crisis, monkeypatch):
    from apps.risk import services

    original = services._entradas_cambiarias

    def fallar_en_argentina(pais):
        if pais.pk == 'AR':
            raise RuntimeError('fallo simulado')
        return original(pais)

    monkeypatch.setattr(services, '_entradas_cambiarias', fallar_en_argentina)
    calculados, errores = recalcular_todos()
    assert [i.pais_id for i in calculados] == ['CO']
    assert errores == ['AR']


# --- Alertas (SPEC §4.5) --------------------------------------------------------------------------

@pytest.mark.django_db
def test_regla_1_irpc_menor_a_25_genera_critical(pais_en_crisis):
    indice = calcular_irpc_pais(pais_en_crisis)
    assert indice.indice_compuesto < 25
    assert Alerta.objects.filter(pais=pais_en_crisis, tipo_alerta='RIESGO', severidad='CRITICAL').count() == 1


@pytest.mark.django_db
def test_alertas_no_se_duplican_si_siguen_sin_leer(pais_en_crisis):
    calcular_irpc_pais(pais_en_crisis)
    calcular_irpc_pais(pais_en_crisis)
    assert Alerta.objects.filter(pais=pais_en_crisis, severidad='CRITICAL').count() == 1
    assert IndiceRiesgo.objects.filter(pais=pais_en_crisis).count() == 2


@pytest.mark.django_db
@pytest.mark.parametrize('anterior, genera', [(Decimal('95'), True), (Decimal('90'), False)])
def test_regla_2_caida_mayor_a_15_puntos(colombia_completa, anterior, genera):
    IndiceRiesgo.objects.create(
        pais=colombia_completa, fecha_calculo=datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
        score_economico=anterior, score_cambiario=anterior, score_estabilidad=anterior,
        indice_compuesto=anterior, nivel_riesgo='BAJO',
    )
    calcular_irpc_pais(colombia_completa)  # IRPC = 75 → caída de 20 o de 15 puntos
    existe = Alerta.objects.filter(pais=colombia_completa, tipo_alerta='RIESGO', severidad='WARNING').exists()
    assert existe is genera


@pytest.mark.django_db
@pytest.mark.parametrize('variacion, genera', [('3.5', True), ('-4.2', True), ('3.0', False), (None, False)])
def test_regla_3_variacion_cambiaria_mayor_a_3(colombia, variacion, genera):
    tipo_cambio = TipoCambio.objects.create(
        moneda_origen=colombia, fecha=HOY, tasa=Decimal('4100'),
        variacion_porcentual=Decimal(variacion) if variacion else None,
    )
    alerta = generar_alerta_tipo_cambio(tipo_cambio)
    assert (alerta is not None) is genera
    if genera:
        assert (alerta.tipo_alerta, alerta.severidad) == ('TIPO_CAMBIO', 'WARNING')


@pytest.mark.django_db
def test_reglas_4_y_5_nuevos_indicadores_e_hiperinflacion(pais_en_crisis):
    nuevos = list(IndicadorEconomico.objects.filter(pais=pais_en_crisis, anio=2023))
    alertas = generar_alertas_indicadores(pais_en_crisis, nuevos)
    assert sorted((a.tipo_alerta, a.severidad) for a in alertas) == [
        ('INDICADOR', 'CRITICAL'), ('INDICADOR', 'INFO'),
    ]
    assert all(a.usuario is None for a in alertas)


@pytest.mark.django_db
def test_sin_indicadores_nuevos_no_genera_alertas(colombia):
    assert generar_alertas_indicadores(colombia, []) == []
    assert not Alerta.objects.exists()
