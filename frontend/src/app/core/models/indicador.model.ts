import { DecimalString, FechaHoraIso, ParametrosListado } from './api.model';

export type TipoIndicador =
  'PIB' | 'INFLACION' | 'DESEMPLEO' | 'BALANZA_COMERCIAL' | 'DEUDA_PIB' | 'PIB_PERCAPITA';

export type UnidadIndicador = 'PORCENTAJE' | 'USD' | 'USD_MILES_MILLONES';
export type FuenteIndicador = 'WORLD_BANK' | 'MANUAL';

export interface IndicadorEconomico {
  id: number;
  pais: string;
  tipo: TipoIndicador;
  tipo_display: string;
  valor: DecimalString;
  unidad: UnidadIndicador;
  anio: number;
  fuente: FuenteIndicador;
  fecha_actualizacion: FechaHoraIso;
}

export interface FiltrosIndicador extends ParametrosListado {
  tipo?: TipoIndicador;
  anio?: number;
  anio_desde?: number;
  anio_hasta?: number;
  fuente?: FuenteIndicador;
}
