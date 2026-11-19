/** Valor numérico tal como llega de la API (los decimales de DRF son cadenas). */
export type ValorNumerico = number | string | null | undefined;

export const LOCALE = 'es-CO';
export const SIN_DATO = '—';

export function aNumero(valor: ValorNumerico): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
