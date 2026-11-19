"""Métricas de portafolio: totales, distribución por país / tipo de activo y riesgo ponderado por monto."""
from collections import defaultdict
from decimal import Decimal

from apps.risk.irpc import clasificar
from apps.risk.selectors import irpc_por_pais

from .models import Posicion

MONTO_MAXIMO_ACTIVO_PORTAFOLIO = Decimal('50000000')
MAX_POSICIONES_ACTIVAS_IGUALES = 2


def _redondear(valor):
    return None if valor is None else round(float(valor), 2)


def _porcentaje(parte, total):
    return round(float(parte / total * 100), 2) if total else 0.0


def _distribucion(montos, total, describir):
    filas = [{**describir(clave), 'monto': _redondear(monto), 'porcentaje': _porcentaje(monto, total)}
             for clave, monto in montos.items()]
    return sorted(filas, key=lambda fila: fila['monto'], reverse=True)


def calcular_metricas(portafolio, posiciones=None):
    """
    Métricas sobre las posiciones activas. El riesgo promedio ponderado es Σ(monto × IRPC) / Σ(monto)
    considerando solo los países que tienen un IRPC calculado.
    """
    if posiciones is None:
        posiciones = portafolio.posiciones.select_related('pais')
    posiciones = list(posiciones)
    activas = [p for p in posiciones if p.fecha_salida is None]
    indices = irpc_por_pais()

    total = sum((p.monto_inversion_usd for p in activas), Decimal(0))
    por_pais, por_tipo, paises = defaultdict(Decimal), defaultdict(Decimal), {}
    suma_ponderada, monto_con_irpc = Decimal(0), Decimal(0)
    for posicion in activas:
        por_pais[posicion.pais_id] += posicion.monto_inversion_usd
        por_tipo[posicion.tipo_activo] += posicion.monto_inversion_usd
        paises[posicion.pais_id] = posicion.pais
        indice = indices.get(posicion.pais_id)
        if indice is not None:
            suma_ponderada += posicion.monto_inversion_usd * indice.indice_compuesto
            monto_con_irpc += posicion.monto_inversion_usd

    riesgo = suma_ponderada / monto_con_irpc if monto_con_irpc else None
    nivel, color, accion = clasificar(riesgo) if riesgo is not None else (None, None, None)

    def describir_pais(iso):
        indice = indices.get(iso)
        return {
            'pais': iso, 'nombre': paises[iso].nombre,
            'irpc': _redondear(indice.indice_compuesto) if indice else None,
            'nivel_riesgo': indice.nivel_riesgo if indice else None,
            'color': clasificar(indice.indice_compuesto)[1] if indice else None,
        }

    def describir_tipo(tipo):
        return {'tipo_activo': tipo, 'etiqueta': Posicion.TipoActivo(tipo).label}

    return {
        'monto_total_activo': _redondear(total),
        'monto_total_historico': _redondear(sum((p.monto_inversion_usd for p in posiciones), Decimal(0))),
        'limite_monto_activo': _redondear(MONTO_MAXIMO_ACTIVO_PORTAFOLIO),
        'monto_disponible': _redondear(MONTO_MAXIMO_ACTIVO_PORTAFOLIO - total),
        'posiciones_activas': len(activas),
        'posiciones_cerradas': len(posiciones) - len(activas),
        'riesgo_promedio_ponderado': _redondear(riesgo),
        'nivel_riesgo': nivel,
        'color_riesgo': color,
        'accion_recomendada': accion,
        'distribucion_pais': _distribucion(por_pais, total, describir_pais),
        'distribucion_tipo_activo': _distribucion(por_tipo, total, describir_tipo),
    }
