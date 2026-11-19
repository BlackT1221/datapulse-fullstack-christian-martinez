/** Reglas de negocio de portafolios (espejo de `apps.portfolios` en el backend). */
export const MONTO_MINIMO_POSICION = 1_000;
export const MONTO_MAXIMO_POSICION = 10_000_000;
export const MONTO_MAXIMO_ACTIVO_PORTAFOLIO = 50_000_000;
export const MAX_POSICIONES_ACTIVAS_IGUALES = 2;

export const NOMBRE_PORTAFOLIO_MIN = 3;
export const NOMBRE_PORTAFOLIO_MAX = 100;
export const DESCRIPCION_PORTAFOLIO_MAX = 500;
export const NOTAS_POSICION_MAX = 200;

/** Moneda de los países dolarizados: no admiten posiciones de tipo `MONEDA`. */
export const MONEDA_DOLAR = 'USD';
