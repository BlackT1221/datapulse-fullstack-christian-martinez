"""Filtrado y orden para querysets secundarios de acciones (@action) que no usan los filtros globales."""
from rest_framework import exceptions


def filtrar_y_ordenar(request, filterset_class, queryset, ordenables, orden_defecto):
    """Aplica un FilterSet y el parámetro `ordering` (restringido a `ordenables`) a un queryset."""
    filtro = filterset_class(request.query_params, queryset=queryset, request=request)
    if not filtro.is_valid():
        raise exceptions.ValidationError(filtro.errors)
    orden = [campo.strip() for campo in request.query_params.get('ordering', '').split(',') if campo.strip()]
    invalidos = [campo for campo in orden if campo.lstrip('-') not in ordenables]
    if invalidos:
        raise exceptions.ValidationError({'ordering': [
            f'Campo de orden no permitido: {", ".join(invalidos)}. Opciones: {", ".join(ordenables)}.'
        ]})
    return filtro.qs.order_by(*(orden or orden_defecto))
