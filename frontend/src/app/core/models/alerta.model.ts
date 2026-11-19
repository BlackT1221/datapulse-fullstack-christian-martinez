import { FechaHoraIso, ParametrosListado } from './api.model';

export type TipoAlerta = 'RIESGO' | 'TIPO_CAMBIO' | 'INDICADOR';
export type Severidad = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Alerta {
  id: number;
  usuario: number | null;
  es_global: boolean;
  pais: string;
  pais_nombre: string;
  tipo_alerta: TipoAlerta;
  severidad: Severidad;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion: FechaHoraIso;
}

export interface ResumenAlertas {
  total: number;
  no_leidas: number;
  por_tipo: Record<TipoAlerta, number>;
  por_severidad: Record<Severidad, number>;
  no_leidas_por_severidad: Record<Severidad, number>;
}

export interface ResultadoLeerTodas {
  actualizadas: number;
}

export interface FiltrosAlerta extends ParametrosListado {
  leida?: boolean;
  tipo?: TipoAlerta;
  severidad?: Severidad;
  pais?: string;
}
