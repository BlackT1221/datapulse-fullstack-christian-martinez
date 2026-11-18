import { Severidad, TipoAlerta } from './alerta.model';
import { TipoIndicador } from './indicador.model';
import { Region } from './pais.model';
import { TipoActivo } from './posicion.model';
import { NivelRiesgo } from './riesgo.model';
import { Rol } from './usuario.model';

/** Etiquetas y metadatos de presentación (UI en español) para los enumerados del dominio. */
export const ETIQUETAS_ROL: Readonly<Record<Rol, string>> = {
  ADMIN: 'Administrador',
  ANALISTA: 'Analista',
  VIEWER: 'Observador',
};

export const ETIQUETAS_REGION: Readonly<Record<Region, string>> = {
  ANDINA: 'Andina',
  CONO_SUR: 'Cono Sur',
  CENTROAMERICA: 'Centroamérica',
  CARIBE: 'Caribe',
};

export const ETIQUETAS_INDICADOR: Readonly<Record<TipoIndicador, string>> = {
  PIB: 'PIB',
  INFLACION: 'Inflación',
  DESEMPLEO: 'Desempleo',
  BALANZA_COMERCIAL: 'Balanza comercial',
  DEUDA_PIB: 'Deuda / PIB',
  PIB_PERCAPITA: 'PIB per cápita',
};

export const ETIQUETAS_TIPO_ACTIVO: Readonly<Record<TipoActivo, string>> = {
  RENTA_FIJA: 'Renta fija',
  RENTA_VARIABLE: 'Renta variable',
  COMMODITIES: 'Commodities',
  MONEDA: 'Moneda',
};

export interface InfoNivelRiesgo {
  etiqueta: string;
  color: string;
  accion: string;
  desde: number;
}

export const NIVELES_RIESGO: Readonly<Record<NivelRiesgo, InfoNivelRiesgo>> = {
  BAJO: { etiqueta: 'Bajo', color: '#22c55e', accion: 'Favorable para inversión', desde: 75 },
  MODERADO: {
    etiqueta: 'Moderado',
    color: '#eab308',
    accion: 'Invertir con precaución',
    desde: 50,
  },
  ALTO: { etiqueta: 'Alto', color: '#f97316', accion: 'Reducir exposición', desde: 25 },
  CRITICO: { etiqueta: 'Crítico', color: '#ef4444', accion: 'Evitar nueva inversión', desde: 0 },
};

export interface InfoSeveridad {
  etiqueta: string;
  icono: string;
  color: string;
}

export const SEVERIDADES: Readonly<Record<Severidad, InfoSeveridad>> = {
  INFO: { etiqueta: 'Informativa', icono: 'info', color: '#3b82f6' },
  WARNING: { etiqueta: 'Advertencia', icono: 'warning', color: '#f59e0b' },
  CRITICAL: { etiqueta: 'Crítica', icono: 'error', color: '#ef4444' },
};

export const ETIQUETAS_TIPO_ALERTA: Readonly<Record<TipoAlerta, string>> = {
  RIESGO: 'Riesgo',
  TIPO_CAMBIO: 'Tipo de cambio',
  INDICADOR: 'Indicador',
};

/** Clasificación IRPC equivalente a `apps.risk.irpc.clasificar` del backend. */
export function clasificarIrpc(irpc: number): NivelRiesgo {
  if (irpc >= NIVELES_RIESGO.BAJO.desde) return 'BAJO';
  if (irpc >= NIVELES_RIESGO.MODERADO.desde) return 'MODERADO';
  if (irpc >= NIVELES_RIESGO.ALTO.desde) return 'ALTO';
  return 'CRITICO';
}
