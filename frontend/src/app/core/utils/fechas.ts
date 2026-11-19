import { FechaIso } from '../models';

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/** `Date` (hora local) → `YYYY-MM-DD` sin desplazamiento por zona horaria. */
export function aFechaIso(fecha: Date): FechaIso {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

/** `YYYY-MM-DD` → `Date` a medianoche local (evita que `new Date(iso)` reste un día en UTC-5). */
export function desdeFechaIso(iso: FechaIso): Date {
  const [anio = 1970, mes = 1, dia = 1] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Hoy a medianoche local. */
export function hoy(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}
