"""Endpoints agregados para el dashboard: KPIs, datos del mapa y tendencias de indicadores."""
from django.db.models import Avg, Count, Max
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import exceptions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.countries.models import IndicadorEconomico, Pais
from apps.portfolios.models import Portafolio
from apps.risk.irpc import ESCALA, clasificar
from apps.risk.models import Alerta
from apps.risk.selectors import alertas_visibles, irpc_por_pais, ultimos_indices

TAG = ['Dashboard']
ANIOS_TENDENCIA, ANIOS_MAXIMOS = 5, 20


def _redondear(valor):
    return None if valor is None else round(float(valor), 2)


class DashboardBaseView(APIView):
    permission_classes = (IsAuthenticated,)


class ResumenDashboardView(DashboardBaseView):
    @extend_schema(tags=TAG, summary='KPIs globales: países, alertas activas, portafolios y promedio IRPC',
                   responses=OpenApiTypes.OBJECT)
    def get(self, request):
        indices = ultimos_indices().filter(pais__activo=True)
        agregado = indices.aggregate(promedio=Avg('indice_compuesto'), ultima=Max('fecha_calculo'))
        promedio = agregado['promedio']
        nivel, color, _ = clasificar(promedio) if promedio is not None else (None, None, None)
        niveles = dict(indices.values_list('nivel_riesgo').annotate(n=Count('pk')).order_by())
        no_leidas = alertas_visibles(request.user).filter(leida=False)
        propios = Portafolio.objects.filter(activo=True, usuario=request.user)
        return Response({
            'total_paises': Pais.objects.filter(activo=True).count(),
            'alertas_activas': no_leidas.count(),
            'alertas_criticas': no_leidas.filter(severidad=Alerta.Severidad.CRITICAL).count(),
            'portafolios_usuario': propios.count(),
            'portafolios_publicos': Portafolio.objects.filter(activo=True, es_publico=True).count(),
            'promedio_irpc': _redondear(promedio),
            'nivel_promedio': nivel,
            'color_promedio': color,
            'distribucion_niveles': {n: niveles.get(n, 0) for _, n, _, _ in ESCALA},
            'ultima_actualizacion_irpc': agregado['ultima'],
        })


class MapaDashboardView(DashboardBaseView):
    @extend_schema(tags=TAG, summary='Países con coordenadas, IRPC y color para el mapa',
                   responses=OpenApiTypes.OBJECT)
    def get(self, request):
        indices = irpc_por_pais()
        no_leidas = alertas_visibles(request.user).filter(leida=False)
        alertas = dict(no_leidas.values_list('pais').annotate(n=Count('pk')).order_by())
        paises = []
        for pais in Pais.objects.filter(activo=True).order_by('nombre'):
            indice = indices.get(pais.pk)
            nivel, color, accion = clasificar(indice.indice_compuesto) if indice else (None, '#94a3b8', None)
            paises.append({
                'codigo_iso': pais.pk, 'nombre': pais.nombre, 'region': pais.region,
                'latitud': float(pais.latitud), 'longitud': float(pais.longitud),
                'bandera_url': pais.bandera_url,
                'irpc': _redondear(indice.indice_compuesto) if indice else None,
                'nivel_riesgo': nivel, 'color': color, 'accion_recomendada': accion,
                'fecha_calculo': indice.fecha_calculo if indice else None,
                'alertas_no_leidas': alertas.get(pais.pk, 0),
            })
        leyenda = [{'nivel': nivel, 'desde': int(limite), 'color': color, 'accion': accion}
                   for limite, nivel, color, accion in ESCALA]
        return Response({'paises': paises, 'leyenda': leyenda})


class TendenciasDashboardView(DashboardBaseView):
    @extend_schema(
        tags=TAG, summary='Series de un indicador por país (últimos años)', responses=OpenApiTypes.OBJECT,
        parameters=[
            OpenApiParameter('tipo', OpenApiTypes.STR, description='Indicador (por defecto PIB_PERCAPITA)'),
            OpenApiParameter('paises', OpenApiTypes.STR,
                             description='Códigos ISO separados por coma (ej. CO,BR,MX)'),
            OpenApiParameter('anios', OpenApiTypes.INT,
                             description=f'Años hacia atrás (por defecto {ANIOS_TENDENCIA})'),
        ],
    )
    def get(self, request):
        tipo, codigos, anios = self._parametros(request.query_params)
        paises = Pais.objects.filter(activo=True).order_by('nombre')
        if codigos:
            paises = paises.filter(pk__in=codigos)
            faltantes = sorted(set(codigos) - set(paises.values_list('pk', flat=True)))
            if faltantes:
                raise exceptions.ValidationError({
                    'paises': [f'Países no encontrados: {", ".join(faltantes)}.'],
                })

        indicadores = IndicadorEconomico.objects.filter(tipo=tipo, pais__in=paises)
        ultimo = indicadores.aggregate(m=Max('anio'))['m']
        rango = list(range(ultimo - anios + 1, ultimo + 1)) if ultimo else []
        valores = {(i.pais_id, i.anio): i.valor for i in indicadores.filter(anio__in=rango)}
        unidad = indicadores.values_list('unidad', flat=True).first()
        return Response({
            'tipo': tipo, 'tipo_display': IndicadorEconomico.Tipo(tipo).label, 'unidad': unidad,
            'anios': rango,
            'series': [
                {'pais': pais.pk, 'nombre': pais.nombre,
                 'valores': [_redondear(valores.get((pais.pk, anio))) for anio in rango]}
                for pais in paises
            ],
        })

    @staticmethod
    def _parametros(params):
        tipo = params.get('tipo', IndicadorEconomico.Tipo.PIB_PERCAPITA).upper()
        if tipo not in IndicadorEconomico.Tipo.values:
            raise exceptions.ValidationError({'tipo': [
                f'Indicador no válido. Opciones: {", ".join(IndicadorEconomico.Tipo.values)}.'
            ]})
        codigos = [c.strip().upper() for c in params.get('paises', '').split(',') if c.strip()]
        anios = params.get('anios', str(ANIOS_TENDENCIA))
        if not anios.isdigit() or not 1 <= int(anios) <= ANIOS_MAXIMOS:
            raise exceptions.ValidationError({'anios': [f'Debe ser un entero entre 1 y {ANIOS_MAXIMOS}.']})
        return tipo, codigos, int(anios)
