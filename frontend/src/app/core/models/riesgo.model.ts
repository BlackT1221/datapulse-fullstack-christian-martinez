import { DecimalString, FechaHoraIso, FechaIso, ParametrosListado } from './api.model';
import { Region } from './pais.model';

export type NivelRiesgo = 'BAJO' | 'MODERADO' | 'ALTO' | 'CRITICO';
export type Tendencia = 'SUBE' | 'BAJA' | 'ESTABLE';
export type ScoreIrpc = 'score_economico' | 'score_cambiario' | 'score_estabilidad';

/** Claves de entrada del motor IRPC (`apps.risk.irpc.UMBRALES`). */
export type EntradaIrpc =
  | 'PIB_PERCAPITA'
  | 'INFLACION'
  | 'DESEMPLEO'
  | 'DEUDA_PIB'
  | 'VOLATILIDAD'
  | 'DEPRECIACION'
  | 'BALANZA_COMERCIAL'
  | 'CRECIMIENTO_PIB';

export interface DetalleCalculoIrpc {
  entradas: Partial<Record<EntradaIrpc, number>>;
  /** Puntos restados por entrada, más `INDICADORES_NEGATIVOS`. */
  penalizaciones: Partial<Record<EntradaIrpc | 'INDICADORES_NEGATIVOS', number>>;
  indicadores_negativos: number;
  indicadores_faltantes: string[];
  datos_completos: boolean;
  periodo: { indicadores: unknown; tipo_cambio: unknown };
  pesos: Partial<Record<ScoreIrpc, number>>;
  color: string;
  accion_recomendada: string;
}

/** Campos comunes a todas las representaciones de un `IndiceRiesgo`. */
export interface IndiceRiesgoBase {
  id: number;
  pais: string;
  pais_nombre: string;
  fecha_calculo: FechaHoraIso;
  score_economico: DecimalString;
  score_cambiario: DecimalString;
  score_estabilidad: DecimalString;
  indice_compuesto: DecimalString;
  nivel_riesgo: NivelRiesgo;
  color: string;
  accion_recomendada: string;
}

export interface IndiceRiesgo extends IndiceRiesgoBase {
  detalle_calculo: DetalleCalculoIrpc;
}

export interface RankingRiesgo extends IndiceRiesgoBase {
  posicion: number | null;
  bandera_url: string;
  region: Region;
  variacion: number | null;
  tendencia: Tendencia | null;
}

export interface RiesgoDetalle extends IndiceRiesgo {
  historico: IndiceRiesgoBase[];
}

export interface ResultadoRecalculo {
  calculados: number;
  errores: unknown[];
  ranking: RankingRiesgo[];
}

export interface FiltrosRanking extends ParametrosListado {
  nivel_riesgo?: NivelRiesgo;
  region?: Region;
}

export interface FiltrosHistorico extends ParametrosListado {
  fecha_desde?: FechaIso;
  fecha_hasta?: FechaIso;
  nivel_riesgo?: NivelRiesgo;
}
