import { Pipe, PipeTransform } from '@angular/core';

import { UnidadIndicador } from '../../core/models';
import { aNumero, LOCALE, SIN_DATO, ValorNumerico } from './numero';

function decimal(numero: number, decimales: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: decimales }).format(numero);
}

/** Formatea un indicador según su unidad; reutilizable fuera de plantillas (ejes de gráficos). */
export function formatearIndicador(valor: ValorNumerico, unidad: UnidadIndicador | null): string {
  const numero = aNumero(valor);
  if (numero === null) {
    return SIN_DATO;
  }
  switch (unidad) {
    case 'PORCENTAJE':
      return `${decimal(numero, 1)} %`;
    case 'USD_MILES_MILLONES':
      return `US$ ${decimal(numero, 1)} mil M`;
    case 'USD': {
      const grande = Math.abs(numero) >= 1e9;
      return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: 'USD',
        notation: grande ? 'compact' : 'standard',
        maximumFractionDigits: grande ? 1 : 0,
      }).format(numero);
    }
    case null:
      return decimal(numero, 2);
  }
}

/** Formatea el valor de un indicador según su unidad (`PORCENTAJE`, `USD`, `USD_MILES_MILLONES`). */
@Pipe({ name: 'valorIndicador' })
export class ValorIndicadorPipe implements PipeTransform {
  transform(valor: ValorNumerico, unidad: UnidadIndicador | null): string {
    return formatearIndicador(valor, unidad);
  }
}
