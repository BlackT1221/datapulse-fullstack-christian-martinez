import { DecimalString, ParametrosListado } from './api.model';
import { IndicadorEconomico } from './indicador.model';
import { NivelRiesgo } from './riesgo.model';
import { TipoCambio } from './tipo-cambio.model';

export type Region = 'ANDINA' | 'CONO_SUR' | 'CENTROAMERICA' | 'CARIBE';

export type CodigoIso = 'CO' | 'BR' | 'MX' | 'AR' | 'CL' | 'PE' | 'EC' | 'UY' | 'PY' | 'PA';

export interface Pais {
  codigo_iso: string;
  nombre: string;
  moneda_codigo: string;
  moneda_nombre: string;
  region: Region;
  region_display: string;
  latitud: DecimalString;
  longitud: DecimalString;
  poblacion: number;
  bandera_url: string;
  activo: boolean;
  irpc: DecimalString | null;
  nivel_riesgo: NivelRiesgo | null;
  color_riesgo: string | null;
}

export interface PaisDetalle extends Pais {
  indicadores_actuales: IndicadorEconomico[];
  tipo_cambio_actual: TipoCambio | null;
}

export interface FiltrosPais extends ParametrosListado {
  region?: Region;
  activo?: boolean;
}

export interface ResultadoSincronizacionFuente {
  procesados: number;
  actualizados: number;
  errores: { contexto: string; mensaje: string }[];
}

export interface ResultadoSincronizacion {
  indicadores: ResultadoSincronizacionFuente;
  tipos_cambio: ResultadoSincronizacionFuente;
  irpc: { calculados: number; errores: unknown[] };
}
