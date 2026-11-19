"""
Clientes tolerantes a fallos para las APIs externas (SPEC §3.2 y §6.1).

Reglas: timeout de 10 s, ninguna excepción de red o de formato se propaga; cada país se procesa
de forma aislada y los errores se registran con `logging` para continuar con el resto del lote.
"""
import logging
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

import requests
from django.conf import settings
from django.utils import timezone

from .models import IndicadorEconomico, Pais, TipoCambio

logger = logging.getLogger(__name__)

TIMEOUT = 10
WORLD_BANK_URL = getattr(settings, 'WORLD_BANK_API_URL', 'https://api.worldbank.org/v2')
EXCHANGE_RATE_URL = getattr(
    settings, 'EXCHANGE_RATE_API_URL', 'https://api.exchangerate-api.com/v4/latest/USD'
)
REST_COUNTRIES_URL = getattr(settings, 'REST_COUNTRIES_API_URL', 'https://restcountries.com/v3.1/alpha')

# Código World Bank → (tipo interno, unidad).
INDICADORES_WORLD_BANK = {
    'NY.GDP.MKTP.CD': ('PIB', IndicadorEconomico.Unidad.USD),
    'FP.CPI.TOTL.ZG': ('INFLACION', IndicadorEconomico.Unidad.PORCENTAJE),
    'SL.UEM.TOTL.ZS': ('DESEMPLEO', IndicadorEconomico.Unidad.PORCENTAJE),
    'NE.RSB.GNFS.ZS': ('BALANZA_COMERCIAL', IndicadorEconomico.Unidad.PORCENTAJE),
    'GC.DOD.TOTL.GD.ZS': ('DEUDA_PIB', IndicadorEconomico.Unidad.PORCENTAJE),
    'NY.GDP.PCAP.CD': ('PIB_PERCAPITA', IndicadorEconomico.Unidad.USD),
}


@dataclass
class ResultadoSync:
    procesados: int = 0
    actualizados: int = 0
    errores: list = field(default_factory=list)

    def error(self, contexto, mensaje):
        self.errores.append({'contexto': contexto, 'mensaje': mensaje})


def _get_json(url, params=None):
    """GET con timeout; devuelve el JSON o None ante cualquier fallo de red, HTTP o formato."""
    try:
        respuesta = requests.get(url, params=params, timeout=TIMEOUT)
        respuesta.raise_for_status()
        return respuesta.json()
    except requests.RequestException as exc:
        logger.error('Fallo de red url=%s error=%s', url, exc)
    except ValueError as exc:
        logger.error('Respuesta no JSON url=%s error=%s', url, exc)
    return None


def _decimal(valor):
    try:
        return None if valor is None else Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        return None


# --- World Bank -------------------------------------------------------------------------------------

def obtener_indicador_world_bank(codigo_iso, codigo_indicador, anio_inicio, anio_fin):
    """Devuelve {anio: Decimal} con los valores no nulos, o None si la consulta falló."""
    datos = _get_json(
        f'{WORLD_BANK_URL}/country/{codigo_iso}/indicator/{codigo_indicador}',
        {'date': f'{anio_inicio}:{anio_fin}', 'format': 'json', 'per_page': 100},
    )
    if not isinstance(datos, list) or len(datos) < 2 or not isinstance(datos[1], list):
        if datos is not None:
            logger.error('Formato inesperado World Bank pais=%s indicador=%s', codigo_iso, codigo_indicador)
        return None
    valores = {}
    for registro in datos[1]:
        valor = _decimal(registro.get('value')) if isinstance(registro, dict) else None
        anio = str(registro.get('date', '')) if isinstance(registro, dict) else ''
        if valor is not None and anio.isdigit():
            valores[int(anio)] = valor
    return valores


def sincronizar_indicadores(paises=None, anio_inicio=None, anio_fin=None):
    """Sincroniza 6 indicadores × países desde World Bank y dispara alertas de indicadores."""
    from apps.risk.services import generar_alertas_indicadores

    anio_fin = anio_fin or timezone.localdate().year - 1
    anio_inicio = anio_inicio or anio_fin - 4
    paises = paises if paises is not None else Pais.objects.filter(activo=True)
    resultado = ResultadoSync()
    for pais in paises:
        nuevos = []
        for codigo, (tipo, unidad) in INDICADORES_WORLD_BANK.items():
            try:
                valores = obtener_indicador_world_bank(pais.codigo_iso, codigo, anio_inicio, anio_fin)
                if valores is None:
                    resultado.error(f'{pais.codigo_iso}/{tipo}', 'No se pudo obtener el indicador.')
                    continue
                if not valores:
                    logger.warning('Sin datos World Bank pais=%s indicador=%s', pais.codigo_iso, tipo)
                for anio, valor in valores.items():
                    indicador, creado = IndicadorEconomico.objects.get_or_create(
                        pais=pais, tipo=tipo, anio=anio,
                        defaults={'valor': valor, 'unidad': unidad,
                                  'fuente': IndicadorEconomico.Fuente.WORLD_BANK},
                    )
                    if not creado and indicador.valor != valor:
                        indicador.valor, indicador.unidad = valor, unidad
                        indicador.fuente = IndicadorEconomico.Fuente.WORLD_BANK
                        indicador.save()
                    elif not creado:
                        continue
                    nuevos.append(indicador)
            except Exception as exc:  # noqa: BLE001 — un indicador fallido no detiene el lote.
                logger.exception('Error sincronizando pais=%s indicador=%s', pais.codigo_iso, tipo)
                resultado.error(f'{pais.codigo_iso}/{tipo}', str(exc))
        resultado.procesados += 1
        resultado.actualizados += len(nuevos)
        generar_alertas_indicadores(pais, nuevos)
    logger.info('Sincronización World Bank paises=%s actualizados=%s errores=%s',
                resultado.procesados, resultado.actualizados, len(resultado.errores))
    return resultado


# --- ExchangeRate-API --------------------------------------------------------------------------------

def obtener_tasas_cambio():
    """Devuelve {moneda: Decimal} (unidades locales por USD) o None si la API no responde."""
    datos = _get_json(EXCHANGE_RATE_URL)
    tasas = datos.get('rates') if isinstance(datos, dict) else None
    if not isinstance(tasas, dict):
        if datos is not None:
            logger.error('Formato inesperado ExchangeRate-API')
        return None
    return {moneda: _decimal(tasa) for moneda, tasa in tasas.items() if _decimal(tasa)}


def actualizar_tipos_cambio(paises=None, fecha=None):
    """Guarda la tasa diaria de cada país, calcula la variación vs. el día anterior y dispara alertas."""
    from apps.risk.services import generar_alerta_tipo_cambio

    fecha = fecha or timezone.localdate()
    resultado = ResultadoSync()
    tasas = obtener_tasas_cambio()
    if tasas is None:
        resultado.error('EXCHANGE_RATE_API', 'No se pudieron obtener las tasas de cambio.')
        return resultado
    paises = paises if paises is not None else Pais.objects.filter(activo=True)
    for pais in paises:
        try:
            tasa = tasas.get(pais.moneda_codigo)
            if tasa is None:
                logger.error('Tasa no disponible moneda=%s', pais.moneda_codigo)
                resultado.error(pais.moneda_codigo, 'Tasa no disponible en la respuesta.')
                continue
            anterior = (TipoCambio.objects.filter(moneda_origen=pais, moneda_destino='USD', fecha__lt=fecha)
                        .order_by('-fecha').first())
            variacion = None
            if anterior is not None and anterior.tasa:
                variacion = ((tasa - anterior.tasa) / anterior.tasa * 100).quantize(Decimal('0.0001'))
            tipo_cambio, _ = TipoCambio.objects.update_or_create(
                moneda_origen=pais, moneda_destino='USD', fecha=fecha,
                defaults={'tasa': tasa.quantize(Decimal('0.000001')), 'variacion_porcentual': variacion,
                          'fuente': 'EXCHANGERATE_API'},
            )
            resultado.procesados += 1
            resultado.actualizados += 1
            generar_alerta_tipo_cambio(tipo_cambio)
        except Exception as exc:  # noqa: BLE001
            logger.exception('Error actualizando tipo de cambio moneda=%s', pais.moneda_codigo)
            resultado.error(pais.moneda_codigo, str(exc))
    return resultado


# --- REST Countries ----------------------------------------------------------------------------------

def obtener_datos_pais(codigo_iso):
    """Nombre oficial, monedas, población, coordenadas y bandera; None si la consulta falla."""
    datos = _get_json(f'{REST_COUNTRIES_URL}/{codigo_iso}')
    registro = datos[0] if isinstance(datos, list) and datos else datos
    if not isinstance(registro, dict):
        return None
    latlng = registro.get('latlng') or [None, None]
    return {
        'nombre_oficial': (registro.get('name') or {}).get('official'),
        'monedas': list((registro.get('currencies') or {}).keys()),
        'poblacion': registro.get('population'),
        'latitud': latlng[0] if len(latlng) > 0 else None,
        'longitud': latlng[1] if len(latlng) > 1 else None,
        'bandera_url': (registro.get('flags') or {}).get('png'),
    }


def actualizar_datos_paises(paises=None):
    """Actualiza población y bandera; nombre, moneda y coordenadas se mantienen según SPEC §3.1."""
    paises = paises if paises is not None else Pais.objects.filter(activo=True)
    resultado = ResultadoSync()
    for pais in paises:
        try:
            datos = obtener_datos_pais(pais.codigo_iso)
            if datos is None:
                resultado.error(pais.codigo_iso, 'No se pudieron obtener los datos del país.')
                continue
            campos = []
            if isinstance(datos['poblacion'], int) and datos['poblacion'] > 0:
                pais.poblacion = datos['poblacion']
                campos.append('poblacion')
            if datos['bandera_url']:
                pais.bandera_url = datos['bandera_url']
                campos.append('bandera_url')
            if campos:
                pais.save(update_fields=campos)
                resultado.actualizados += 1
            resultado.procesados += 1
        except Exception as exc:  # noqa: BLE001
            logger.exception('Error actualizando datos del país pais=%s', pais.codigo_iso)
            resultado.error(pais.codigo_iso, str(exc))
    return resultado
