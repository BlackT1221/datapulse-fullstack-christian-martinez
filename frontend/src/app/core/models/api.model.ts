/**
 * Tipos transversales de la API REST.
 * DRF serializa los `DecimalField` como cadenas para no perder precisión.
 */
export type DecimalString = string;

/** Fecha ISO `YYYY-MM-DD`. */
export type FechaIso = string;

/** Fecha y hora ISO 8601 con zona horaria. */
export type FechaHoraIso = string;

export interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ParametrosListado {
  page?: number;
  page_size?: number;
  ordering?: string;
  search?: string;
}

export type DetallesError = Record<string, string[] | string> | string[] | null;

/** Formato estandarizado del `custom_exception_handler` del backend. */
export interface ErrorApi {
  error: true;
  codigo: number;
  mensaje: string;
  detalles: DetallesError;
}
