import { DecimalString, FechaIso, ParametrosListado } from './api.model';

export type TipoActivo = 'RENTA_FIJA' | 'RENTA_VARIABLE' | 'COMMODITIES' | 'MONEDA';

export interface Posicion {
  id: number;
  portafolio: number;
  pais: string;
  pais_nombre: string;
  tipo_activo: TipoActivo;
  tipo_activo_display: string;
  fecha_entrada: FechaIso;
  monto_inversion_usd: DecimalString;
  fecha_salida: FechaIso | null;
  notas: string;
  esta_activa: boolean;
}

export interface PosicionPayload {
  pais: string;
  tipo_activo: TipoActivo;
  fecha_entrada: FechaIso;
  /** Se acepta número o cadena decimal; DRF lo valida en ambos casos. */
  monto_inversion_usd: number | DecimalString;
  fecha_salida?: FechaIso | null;
  notas?: string;
}

export interface FiltrosPosicion extends ParametrosListado {
  activa?: boolean;
  pais?: string;
  tipo_activo?: TipoActivo;
}
