import { DecimalString, FechaIso, ParametrosListado } from './api.model';

export interface TipoCambio {
  id: number;
  moneda_origen: string;
  moneda_destino: string;
  tasa: DecimalString;
  fecha: FechaIso;
  variacion_porcentual: DecimalString | null;
  fuente: string;
}

export interface FiltrosTipoCambio extends ParametrosListado {
  fecha_desde?: FechaIso;
  fecha_hasta?: FechaIso;
}
