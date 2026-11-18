import { Pipe, PipeTransform } from '@angular/core';

import { UnidadIndicador } from '../../core/models';
import { aNumero, LOCALE, SIN_DATO, ValorNumerico } from './numero';

/** Formatea el valor de un indicador según su unidad (`PORCENTAJE`, `USD`, `USD_MILES_MILLONES`). */
@Pipe({ name: 'valorIndicador' })
export class ValorIndicadorPipe implements PipeTransform {
  transform(valor: ValorNumerico, unidad: UnidadIndicador): string {
    const numero = aNumero(valor);
    if (numero === null) {
      return SIN_DATO;
    }
    switch (unidad) {
      case 'PORCENTAJE':
        return `${this.formato(numero, 1)} %`;
      case 'USD_MILES_MILLONES':
        return `US$ ${this.formato(numero, 1)} mil M`;
      case 'USD':
        return new Intl.NumberFormat(LOCALE, {
          style: 'currency',
          currency: 'USD',
          notation: Math.abs(numero) >= 1e9 ? 'compact' : 'standard',
          maximumFractionDigits: Math.abs(numero) >= 1e9 ? 1 : 0,
        }).format(numero);
    }
  }

  private formato(numero: number, decimales: number): string {
    return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: decimales }).format(numero);
  }
}
