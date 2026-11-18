"""
Servicios del Índice de Riesgo País Compuesto (IRPC) y generación automática de alertas (SPEC §4.5).

Este módulo obtiene las entradas desde la base de datos, delega la fórmula en `apps.risk.irpc`
y persiste el resultado. Los datos incompletos nunca lanzan excepción: se calcula con lo disponible
y se registran los faltantes en `detalle_calculo['indicadores_faltantes']`.
"""
import logging
import statistics
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.countries.models import IndicadorEconomico, Pais, TipoCambio

from .irpc import PESOS, calcular_scores
from .models import SCORE_FIELDS, Alerta, IndiceRiesgo

logger = logging.getLogger(__name__)

TIPOS_DIRECTOS = ('PIB_PERCAPITA', 'INFLACION', 'DESEMPLEO', 'DEUDA_PIB', 'BALANZA_COMERCIAL')
VENTANA_TIPO_CAMBIO_DIAS = 30

UMBRAL_IRPC_CRITICO = Decimal(25)
UMBRAL_CAIDA_IRPC = Decimal(15)
UMBRAL_VARIACION_TIPO_CAMBIO = Decimal('3.0')
UMBRAL_HIPERINFLACION = Decimal(50)


# --- Entradas del cálculo -------------------------------------------------------------------------

def _entradas_macro(pais):
    """Último valor disponible de cada indicador y crecimiento del PIB entre los dos años más recientes."""
    series = {}
    for indicador in IndicadorEconomico.objects.filter(pais=pais).order_by('tipo', '-anio'):
        if indicador.valor is not None:
            series.setdefault(indicador.tipo, []).append(indicador)

    entradas, periodo = {}, {}
    for tipo in TIPOS_DIRECTOS:
        if series.get(tipo):
            entradas[tipo] = float(series[tipo][0].valor)
            periodo[tipo] = series[tipo][0].anio

    pib = series.get('PIB', [])
    if len(pib) >= 2 and pib[1].valor:
        actual, anterior = pib[0], pib[1]
        entradas['CRECIMIENTO_PIB'] = float((actual.valor - anterior.valor) / anterior.valor * 100)
        periodo['CRECIMIENTO_PIB'] = f'{anterior.anio}-{actual.anio}'
    return entradas, periodo


def _entradas_cambiarias(pais):
    """Volatilidad (desv. estándar de variaciones diarias) y depreciación acumulada en 30 días."""
    base = TipoCambio.objects.filter(moneda_origen=pais, moneda_destino='USD')
    ultimo = base.order_by('-fecha').first()
    if ultimo is None:
        return {}, {}
    desde = ultimo.fecha - timedelta(days=VENTANA_TIPO_CAMBIO_DIAS - 1)
    serie = list(base.filter(fecha__gte=desde).order_by('fecha'))

    entradas = {}
    variaciones = [float(t.variacion_porcentual) for t in serie if t.variacion_porcentual is not None]
    if len(variaciones) >= 2:
        entradas['VOLATILIDAD'] = statistics.stdev(variaciones)
    if len(serie) >= 2 and serie[0].tasa:
        # Tasas en moneda local por USD: un aumento de la tasa equivale a depreciación.
        entradas['DEPRECIACION'] = float((serie[-1].tasa - serie[0].tasa) / serie[0].tasa * 100)
    periodo = {'desde': serie[0].fecha.isoformat(), 'hasta': ultimo.fecha.isoformat(),
               'observaciones': len(serie)}
    return entradas, periodo


def _detalle(entradas, resultado, periodo_macro, periodo_cambio):
    return {
        'entradas': {clave: round(valor, 4) for clave, valor in entradas.items()},
        'penalizaciones': resultado['penalizaciones'],
        'indicadores_negativos': resultado['indicadores_negativos'],
        'indicadores_faltantes': resultado['indicadores_faltantes'],
        'datos_completos': not resultado['indicadores_faltantes'],
        'periodo': {'indicadores': periodo_macro, 'tipo_cambio': periodo_cambio},
        'pesos': {clave: float(peso) for clave, peso in PESOS.items()},
        'color': resultado['color'],
        'accion_recomendada': resultado['accion_recomendada'],
    }


# --- Cálculo y persistencia ------------------------------------------------------------------------

@transaction.atomic
def calcular_irpc_pais(pais, generar_alertas=True, reemplazar_ultimo=False):
    """
    Calcula y guarda el IRPC de `pais`. Con `reemplazar_ultimo=True` actualiza el último registro
    en lugar de crear uno nuevo (uso idempotente desde `seed_data`).
    """
    macro, periodo_macro = _entradas_macro(pais)
    cambio, periodo_cambio = _entradas_cambiarias(pais)
    entradas = {**macro, **cambio}
    resultado = calcular_scores(entradas)

    if resultado['indicadores_faltantes']:
        logger.warning('IRPC con datos incompletos pais=%s faltantes=%s',
                       pais.pk, ','.join(resultado['indicadores_faltantes']))

    campos = {campo: resultado[campo] for campo in SCORE_FIELDS}
    campos.update(
        nivel_riesgo=resultado['nivel_riesgo'], fecha_calculo=timezone.now(),
        detalle_calculo=_detalle(entradas, resultado, periodo_macro, periodo_cambio),
    )

    historial = IndiceRiesgo.objects.filter(pais=pais).order_by('-fecha_calculo', '-pk')
    ultimo = historial.first() if reemplazar_ultimo else None
    if ultimo is not None:
        anterior = historial.exclude(pk=ultimo.pk).first()
        for campo, valor in campos.items():
            setattr(ultimo, campo, valor)
        ultimo.save()
        indice = ultimo
    else:
        anterior = historial.first()
        indice = IndiceRiesgo.objects.create(pais=pais, **campos)

    logger.info('IRPC calculado pais=%s irpc=%s nivel=%s', pais.pk, indice.indice_compuesto,
                indice.nivel_riesgo)
    if generar_alertas:
        generar_alertas_riesgo(indice, anterior)
    return indice


def recalcular_todos(paises=None):
    """Recalcula el IRPC de todos los países activos; un fallo en un país no detiene el lote."""
    paises = paises if paises is not None else Pais.objects.filter(activo=True)
    calculados, errores = [], []
    for pais in paises:
        try:
            calculados.append(calcular_irpc_pais(pais))
        except Exception:  # noqa: BLE001 — se registra y se continúa con el siguiente país.
            logger.exception('Error calculando IRPC pais=%s', pais.pk)
            errores.append(pais.pk)
    return calculados, errores


# --- Alertas (SPEC §4.5) ---------------------------------------------------------------------------

def _crear_alerta(pais, tipo, severidad, titulo, mensaje):
    """Crea una alerta global; omite duplicados si ya existe una idéntica sin leer."""
    existe = Alerta.objects.filter(
        usuario=None, pais=pais, tipo_alerta=tipo, severidad=severidad, titulo=titulo, leida=False,
    ).exists()
    if existe:
        return None
    alerta = Alerta.objects.create(
        usuario=None, pais=pais, tipo_alerta=tipo, severidad=severidad, titulo=titulo, mensaje=mensaje,
    )
    logger.info('Alerta creada pais=%s tipo=%s severidad=%s', pais.pk, tipo, severidad)
    return alerta


def generar_alertas_riesgo(indice, anterior=None):
    """Reglas 1 (IRPC < 25 → CRITICAL) y 2 (caída > 15 puntos → WARNING)."""
    pais, irpc = indice.pais, indice.indice_compuesto
    alertas = []
    if irpc < UMBRAL_IRPC_CRITICO:
        alertas.append(_crear_alerta(
            pais, Alerta.TipoAlerta.RIESGO, Alerta.Severidad.CRITICAL,
            f'Riesgo crítico en {pais.nombre}',
            f'El IRPC de {pais.nombre} es {irpc} (nivel CRÍTICO). Se recomienda evitar nueva inversión.',
        ))
    if anterior is not None:
        caida = anterior.indice_compuesto - irpc
        if caida > UMBRAL_CAIDA_IRPC:
            alertas.append(_crear_alerta(
                pais, Alerta.TipoAlerta.RIESGO, Alerta.Severidad.WARNING,
                f'Caída de {caida} puntos del IRPC en {pais.nombre}',
                f'El IRPC de {pais.nombre} pasó de {anterior.indice_compuesto} a {irpc}.',
            ))
    return [alerta for alerta in alertas if alerta]


def generar_alerta_tipo_cambio(tipo_cambio):
    """Regla 3: variación diaria del tipo de cambio mayor a 3 % (en valor absoluto) → WARNING."""
    variacion = tipo_cambio.variacion_porcentual
    if variacion is None or abs(Decimal(str(variacion))) <= UMBRAL_VARIACION_TIPO_CAMBIO:
        return None
    pais = tipo_cambio.moneda_origen
    return _crear_alerta(
        pais, Alerta.TipoAlerta.TIPO_CAMBIO, Alerta.Severidad.WARNING,
        f'Variación cambiaria de {variacion:+.2f} % en {pais.moneda_codigo} ({tipo_cambio.fecha})',
        f'El tipo de cambio {pais.moneda_codigo}/{tipo_cambio.moneda_destino} varió {variacion:+.2f} % '
        f'en un día (tasa {tipo_cambio.tasa}).',
    )


def generar_alertas_indicadores(pais, nuevos):
    """Regla 4 (datos nuevos tras sincronizar → INFO) y regla 5 (inflación > 50 % → CRITICAL)."""
    if not nuevos:
        return []
    resumen = ', '.join(sorted(f'{i.tipo} {i.anio}' for i in nuevos))
    alertas = [_crear_alerta(
        pais, Alerta.TipoAlerta.INDICADOR, Alerta.Severidad.INFO,
        f'Nuevos indicadores económicos para {pais.nombre}',
        f'Se sincronizaron {len(nuevos)} indicadores nuevos o actualizados: {resumen}.',
    )]
    alertas += [generar_alerta_hiperinflacion(indicador) for indicador in nuevos]
    return [alerta for alerta in alertas if alerta]


def generar_alerta_hiperinflacion(indicador):
    """Regla 5: inflación anual > 50 % → CRITICAL. Devuelve None si no aplica."""
    if indicador.tipo != IndicadorEconomico.Tipo.INFLACION or indicador.valor is None \
            or Decimal(str(indicador.valor)) <= UMBRAL_HIPERINFLACION:
        return None
    pais = indicador.pais
    return _crear_alerta(
        pais, Alerta.TipoAlerta.INDICADOR, Alerta.Severidad.CRITICAL,
        f'Hiperinflación en {pais.nombre} ({indicador.anio})',
        f'La inflación de {pais.nombre} en {indicador.anio} fue {indicador.valor} %, '
        'superior al umbral de hiperinflación (50 %).',
    )
