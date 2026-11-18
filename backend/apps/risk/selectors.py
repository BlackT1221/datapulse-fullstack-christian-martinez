"""Consultas reutilizables sobre el IRPC (último índice por país, variación respecto al anterior)."""
from django.db.models import OuterRef, Q, Subquery

from .models import Alerta, IndiceRiesgo

TOLERANCIA_TENDENCIA = 0.5  # puntos de IRPC por debajo de los cuales se considera ESTABLE


def _historial_de(campo_pais):
    return IndiceRiesgo.objects.filter(pais=OuterRef(campo_pais)).order_by('-fecha_calculo', '-pk')


def ultimos_indices():
    """Último IndiceRiesgo de cada país, anotado con el IRPC del cálculo inmediatamente anterior."""
    historial = _historial_de('pais')
    return (
        IndiceRiesgo.objects
        .filter(pk=Subquery(historial.values('pk')[:1]))
        .annotate(indice_anterior=Subquery(historial.values('indice_compuesto')[1:2]))
        .select_related('pais')
    )


def anotar_ultimo_irpc(paises):
    """Anota un queryset de Pais con `irpc` y `nivel_riesgo` de su último cálculo."""
    historial = _historial_de('pk')
    return paises.annotate(
        irpc=Subquery(historial.values('indice_compuesto')[:1]),
        nivel_riesgo=Subquery(historial.values('nivel_riesgo')[:1]),
    )


def irpc_por_pais():
    """{codigo_iso: IndiceRiesgo} con el último cálculo de cada país."""
    return {indice.pais_id: indice for indice in ultimos_indices()}


def variacion_y_tendencia(actual, anterior):
    """Devuelve (variación en puntos | None, 'SUBE' | 'BAJA' | 'ESTABLE' | None)."""
    if anterior is None:
        return None, None
    variacion = round(float(actual) - float(anterior), 2)
    if variacion > TOLERANCIA_TENDENCIA:
        return variacion, 'SUBE'
    if variacion < -TOLERANCIA_TENDENCIA:
        return variacion, 'BAJA'
    return variacion, 'ESTABLE'


def alertas_visibles(usuario):
    """Alertas globales (sin usuario) más las dirigidas al usuario."""
    return Alerta.objects.filter(Q(usuario__isnull=True) | Q(usuario=usuario)).select_related('pais')
