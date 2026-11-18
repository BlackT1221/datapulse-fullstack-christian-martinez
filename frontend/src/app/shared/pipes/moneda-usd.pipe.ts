import { Pipe, PipeTransform } from '@angular/core';

import { aNumero, LOCALE, SIN_DATO, ValorNumerico } from './numero';

/** `1234567.5 | usd` → `US$ 1.234.568`; `| usd:2` → `US$ 1.234.567,50`; `| usd:1:true` → `US$ 1,2 M`. */
@Pipe({ name: 'usd' })
export class MonedaUsdPipe implements PipeTransform {
  transform(valor: ValorNumerico, decimales = 0, compacto = false): string {
    const numero = aNumero(valor);
    if (numero === null) {
      return SIN_DATO;
    }
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: 'USD',
      notation: compacto ? 'compact' : 'standard',
      minimumFractionDigits: compacto ? 0 : decimales,
      maximumFractionDigits: decimales,
    }).format(numero);
  }
}
