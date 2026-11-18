import { Pipe, PipeTransform } from '@angular/core';

import { aNumero, LOCALE, SIN_DATO, ValorNumerico } from './numero';

/** `51874024 | numeroCompacto` → `51,9 M` (población, montos grandes). */
@Pipe({ name: 'numeroCompacto' })
export class NumeroCompactoPipe implements PipeTransform {
  transform(valor: ValorNumerico, decimales = 1): string {
    const numero = aNumero(valor);
    if (numero === null) {
      return SIN_DATO;
    }
    return new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      maximumFractionDigits: decimales,
    }).format(numero);
  }
}
