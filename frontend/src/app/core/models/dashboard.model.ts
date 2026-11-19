import { FechaHoraIso } from './api.model';
import { TipoIndicador, UnidadIndicador } from './indicador.model';
import { Region } from './pais.model';
import { NivelRiesgo } from './riesgo.model';

export interface ResumenDashboard {
  total_paises: number;
  alertas_activas: number;
  alertas_criticas: number;
  portafolios_usuario: number;
  portafolios_publicos: number;
  promedio_irpc: number | null;
  nivel_promedio: NivelRiesgo | null;
  color_promedio: string | null;
  distribucion_niveles: Record<NivelRiesgo, number>;
  ultima_actualizacion_irpc: FechaHoraIso | null;
}

export interface PaisMapa {
  codigo_iso: string;
  nombre: string;
  region: Region;
  latitud: number;
  longitud: number;
  bandera_url: string;
  irpc: number | null;
  nivel_riesgo: NivelRiesgo | null;
  /** Color de la escala IRPC; gris `#94a3b8` si el país aún no tiene cálculo. */
  color: string;
  accion_recomendada: string | null;
  fecha_calculo: FechaHoraIso | null;
  alertas_no_leidas: number;
}

export interface LeyendaMapa {
  nivel: NivelRiesgo;
  desde: number;
  color: string;
  accion: string;
}

export interface MapaDashboard {
  paises: PaisMapa[];
  leyenda: LeyendaMapa[];
}

export interface SerieTendencia {
  pais: string;
  nombre: string;
  /** Alineado con `TendenciasDashboard.anios`; `null` si falta el dato de ese año. */
  valores: (number | null)[];
}

export interface TendenciasDashboard {
  tipo: TipoIndicador;
  tipo_display: string;
  unidad: UnidadIndicador | null;
  anios: number[];
  series: SerieTendencia[];
}

export interface FiltrosTendencias {
  tipo?: TipoIndicador;
  /** Códigos ISO separados por coma (p. ej. `CO,BR,MX`). */
  paises?: string;
  anios?: number;
}
