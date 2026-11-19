"""
Motor puro del Índice de Riesgo País Compuesto (IRPC) — SPEC §4.

No accede a la base de datos: recibe valores numéricos (o None si faltan) y devuelve los scores,
lo que permite probar la fórmula de forma aislada. Los umbrales se aplican literalmente según
SPEC §4.2. Nota: el caso de referencia §4.4 asigna -25 a una inflación de 9.2 %, lo que contradice
los tramos de §4.2 (> 5 → -10); se priorizó §4.2 y la discrepancia está documentada en los tests.
"""
from decimal import ROUND_HALF_UP, Decimal

# Clave: (comparador, ((umbral, penalización), ...)) ordenados del tramo más severo al más leve.
UMBRALES = {
    'PIB_PERCAPITA': ('<', ((3000, 30), (6000, 15), (12000, 5))),
    'INFLACION': ('>', ((50, 40), (10, 25), (5, 10))),
    'DESEMPLEO': ('>', ((15, 25), (10, 15), (7, 5))),
    'DEUDA_PIB': ('>', ((80, 20), (50, 10))),
    'VOLATILIDAD': ('>', ((3.0, 40), (1.5, 25), (0.5, 10))),
    'DEPRECIACION': ('>', ((10, 30), (5, 15), (2, 5))),
    'BALANZA_COMERCIAL': ('<', ((-10, 25), (-5, 15), (0, 5))),
    'CRECIMIENTO_PIB': ('<', ((-2, 30), (0, 20), (1, 10))),
}

COMPONENTES = {
    'score_economico': ('PIB_PERCAPITA', 'INFLACION', 'DESEMPLEO', 'DEUDA_PIB'),
    'score_cambiario': ('VOLATILIDAD', 'DEPRECIACION'),
    'score_estabilidad': ('BALANZA_COMERCIAL', 'CRECIMIENTO_PIB'),
}

PESOS = {'score_economico': Decimal('0.40'), 'score_cambiario': Decimal('0.30'),
         'score_estabilidad': Decimal('0.30')}

# Indicadores macroeconómicos considerados para la "concentración de indicadores negativos".
INDICADORES_MACRO = (
    'PIB_PERCAPITA', 'INFLACION', 'DESEMPLEO', 'DEUDA_PIB', 'BALANZA_COMERCIAL', 'CRECIMIENTO_PIB',
)
# Un indicador es "negativo" si su penalización es relevante (>= 10); los tramos de -5 son avisos leves.
UMBRAL_INDICADOR_NEGATIVO = 10
PENALIZACION_POR_NEGATIVO = 5

# (límite inferior, nivel, color hex, acción recomendada) — SPEC §4.3.
ESCALA = (
    (Decimal(75), 'BAJO', '#22c55e', 'Favorable para inversión'),
    (Decimal(50), 'MODERADO', '#eab308', 'Invertir con precaución'),
    (Decimal(25), 'ALTO', '#f97316', 'Reducir exposición'),
    (Decimal(0), 'CRITICO', '#ef4444', 'Evitar nueva inversión'),
)

DOS_DECIMALES = Decimal('0.01')


def penalizacion(clave, valor):
    """Puntos a restar para un indicador; 0 si el valor falta o no supera ningún umbral."""
    if valor is None:
        return 0
    comparador, tramos = UMBRALES[clave]
    for umbral, puntos in tramos:
        if (comparador == '<' and valor < umbral) or (comparador == '>' and valor > umbral):
            return puntos
    return 0


def componer_irpc(score_economico, score_cambiario, score_estabilidad):
    """IRPC = E × 0.40 + C × 0.30 + S × 0.30, acotado a [0, 100] y redondeado a 2 decimales."""
    total = (
        Decimal(str(score_economico)) * PESOS['score_economico']
        + Decimal(str(score_cambiario)) * PESOS['score_cambiario']
        + Decimal(str(score_estabilidad)) * PESOS['score_estabilidad']
    )
    return min(Decimal(100), max(Decimal(0), total)).quantize(DOS_DECIMALES, rounding=ROUND_HALF_UP)


def clasificar(indice):
    """Devuelve (nivel, color, acción) para un IRPC."""
    for limite, nivel, color, accion in ESCALA:
        if Decimal(str(indice)) >= limite:
            return nivel, color, accion
    return ESCALA[-1][1:]


def nivel_riesgo(indice):
    return clasificar(indice)[0]


def calcular_scores(entradas):
    """
    Calcula los tres sub-scores y el IRPC a partir de `entradas` ({clave: float | None}).

    Las claves ausentes o con None se registran en `indicadores_faltantes` y no penalizan;
    nunca lanza excepción por datos incompletos.
    """
    penalizaciones = {clave: penalizacion(clave, entradas.get(clave)) for clave in UMBRALES}
    indicadores_faltantes = sorted(clave for clave in UMBRALES if entradas.get(clave) is None)
    negativos = sum(
        1 for clave in INDICADORES_MACRO if penalizaciones[clave] >= UMBRAL_INDICADOR_NEGATIVO
    )
    penalizaciones['INDICADORES_NEGATIVOS'] = negativos * PENALIZACION_POR_NEGATIVO

    scores = {}
    for componente, claves in COMPONENTES.items():
        restado = sum(penalizaciones[clave] for clave in claves)
        if componente == 'score_estabilidad':
            restado += penalizaciones['INDICADORES_NEGATIVOS']
        scores[componente] = Decimal(max(0, 100 - restado))

    indice = componer_irpc(**scores)
    nivel, color, accion = clasificar(indice)
    return {
        **scores,
        'indice_compuesto': indice,
        'nivel_riesgo': nivel,
        'color': color,
        'accion_recomendada': accion,
        'penalizaciones': penalizaciones,
        'indicadores_negativos': negativos,
        'indicadores_faltantes': indicadores_faltantes,
    }
