import { Pipe, PipeTransform } from '@angular/core';

import { aNumero, LOCALE, SIN_DATO, ValorNumerico } from './numero';

/** Formatea un valor ya expresado en porcentaje: `9.2 | porcentaje` → `9,2 %`; con signo → `+9,2 %`. */
@Pipe({ name: 'porcentaje' })
export class PorcentajePipe implements PipeTransform {
  transform(valor: ValorNumerico, decimales = 1, conSigno = false): string {
    const numero = aNumero(valor);
    if (numero === null) {
      return SIN_DATO;
    }
    const texto = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
      signDisplay: conSigno ? 'exceptZero' : 'auto',
    }).format(numero);
    return `${texto} %`;
  }
}
