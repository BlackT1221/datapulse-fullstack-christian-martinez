import { Pais, Posicion, TipoActivo } from '../../../core/models';

/** Datos mínimos compartidos por los specs del formulario de posiciones. */
export function pais(codigo_iso: string, moneda_codigo: string, nombre = codigo_iso): Pais {
  return {
    codigo_iso,
    nombre,
    moneda_codigo,
    moneda_nombre: moneda_codigo,
    region: 'ANDINA',
    region_display: 'Andina',
    latitud: '0',
    longitud: '0',
    poblacion: 1,
    bandera_url: '',
    activo: true,
    irpc: '60.00',
    nivel_riesgo: 'MODERADO',
    color_riesgo: '#eab308',
  };
}

export const COLOMBIA = pais('CO', 'COP', 'Colombia');
export const ECUADOR = pais('EC', 'USD', 'Ecuador');

let siguienteId = 1;

export function posicion(
  paisIso: string,
  tipo_activo: TipoActivo,
  monto: number,
  extra: Partial<Posicion> = {},
): Posicion {
  return {
    id: siguienteId++,
    portafolio: 1,
    pais: paisIso,
    pais_nombre: paisIso,
    tipo_activo,
    tipo_activo_display: tipo_activo,
    fecha_entrada: '2026-01-15',
    monto_inversion_usd: monto.toFixed(2),
    fecha_salida: null,
    notas: '',
    esta_activa: true,
    ...extra,
  };
}
