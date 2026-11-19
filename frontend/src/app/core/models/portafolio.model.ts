import { FechaHoraIso, ParametrosListado } from './api.model';
import { Posicion, TipoActivo } from './posicion.model';
import { NivelRiesgo } from './riesgo.model';

export interface Portafolio {
  id: number;
  nombre: string;
  descripcion: string;
  es_publico: boolean;
  activo: boolean;
  usuario: number;
  usuario_nombre: string;
  es_propio: boolean;
  monto_total_activo: number;
  posiciones_activas: number;
  fecha_creacion: FechaHoraIso;
  /** Versión para bloqueo optimista: debe reenviarse en cada PUT. */
  fecha_modificacion: FechaHoraIso;
}

export interface DistribucionPais {
  pais: string;
  nombre: string;
  irpc: number | null;
  nivel_riesgo: NivelRiesgo | null;
  color: string | null;
  monto: number;
  porcentaje: number;
}

export interface DistribucionTipoActivo {
  tipo_activo: TipoActivo;
  etiqueta: string;
  monto: number;
  porcentaje: number;
}

export interface MetricasPortafolio {
  monto_total_activo: number;
  monto_total_historico: number;
  limite_monto_activo: number;
  monto_disponible: number;
  posiciones_activas: number;
  posiciones_cerradas: number;
  riesgo_promedio_ponderado: number | null;
  nivel_riesgo: NivelRiesgo | null;
  color_riesgo: string | null;
  accion_recomendada: string | null;
  distribucion_pais: DistribucionPais[];
  distribucion_tipo_activo: DistribucionTipoActivo[];
}

export interface PortafolioDetalle extends Portafolio {
  posiciones: Posicion[];
  metricas: MetricasPortafolio;
}

export interface ResumenPortafolio extends MetricasPortafolio {
  id: number;
  nombre: string;
}

export interface PortafolioPayload {
  nombre: string;
  descripcion?: string;
  es_publico: boolean;
}

export interface PortafolioActualizacion extends PortafolioPayload {
  fecha_modificacion: FechaHoraIso;
}

export interface VerificacionNombre {
  nombre: string;
  disponible: boolean;
  mensaje: string | null;
}

export interface FiltrosPortafolio extends ParametrosListado {
  es_publico?: boolean;
  propios?: boolean;
}

export type FormatoExportacion = 'pdf' | 'xlsx';
