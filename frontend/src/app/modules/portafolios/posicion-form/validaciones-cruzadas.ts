import { AbstractControl, FormGroupDirective, NgForm, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

import {
  ETIQUETAS_TIPO_ACTIVO,
  MAX_POSICIONES_ACTIVAS_IGUALES,
  MONEDA_DOLAR,
  MONTO_MAXIMO_ACTIVO_PORTAFOLIO,
  Pais,
  Posicion,
  TipoActivo,
} from '../../../core/models';
import { esActiva, montoActivo } from '../../../core/utils/metricas-portafolio';

export interface ContextoPosiciones {
  /** Posiciones actuales del portafolio (estado de `PortafolioService`). */
  posiciones: readonly Posicion[];
  /** Posición en edición: se excluye de los totales y conteos. */
  editandoId?: number;
}

export interface ErrorLimiteMonto {
  activoActual: number;
  disponible: number;
  limite: number;
}

export interface ErrorPosicionesIguales {
  pais: string;
  tipo: string;
  maximo: number;
}

export function esPais(valor: unknown): valor is Pais {
  return typeof valor === 'object' && valor !== null && 'codigo_iso' in valor;
}

export function esDolarizado(pais: Pais | null | undefined): boolean {
  return pais?.moneda_codigo === MONEDA_DOLAR;
}

/**
 * Validador de grupo con las 3 reglas cruzadas (espejo de `PosicionSerializer.validate`):
 * 1. `monedaDolarizada`: tipo MONEDA no permitido si la moneda del país es USD.
 * 2. `limiteMonto`: monto activo del portafolio + nuevo monto ≤ US$ 50.000.000.
 * 3. `maxPosicionesIguales`: máximo 2 posiciones activas del mismo tipo en el mismo país.
 * Al ser síncrono, un formulario que lo incumple queda `invalid` y nunca llega al backend.
 */
export function validacionesCruzadas(contexto: () => ContextoPosiciones): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const pais: unknown = grupo.get('pais')?.value;
    const tipo = grupo.get('tipo_activo')?.value as TipoActivo | null;
    const monto = grupo.get('monto_inversion_usd')?.value as number | null;
    const { posiciones, editandoId } = contexto();
    const errores: ValidationErrors = {};

    if (esPais(pais) && tipo === 'MONEDA' && esDolarizado(pais)) {
      errores['monedaDolarizada'] = { pais: pais.nombre };
    }

    if (typeof monto === 'number' && Number.isFinite(monto)) {
      const activoActual = montoActivo(posiciones, editandoId);
      if (activoActual + monto > MONTO_MAXIMO_ACTIVO_PORTAFOLIO) {
        errores['limiteMonto'] = {
          activoActual,
          disponible: Math.max(0, MONTO_MAXIMO_ACTIVO_PORTAFOLIO - activoActual),
          limite: MONTO_MAXIMO_ACTIVO_PORTAFOLIO,
        } satisfies ErrorLimiteMonto;
      }
    }

    if (esPais(pais) && tipo) {
      const iguales = posiciones.filter(
        (p) =>
          esActiva(p) && p.id !== editandoId && p.pais === pais.codigo_iso && p.tipo_activo === tipo,
      ).length;
      if (iguales >= MAX_POSICIONES_ACTIVAS_IGUALES) {
        errores['maxPosicionesIguales'] = {
          pais: pais.nombre,
          tipo: ETIQUETAS_TIPO_ACTIVO[tipo],
          maximo: MAX_POSICIONES_ACTIVAS_IGUALES,
        } satisfies ErrorPosicionesIguales;
      }
    }

    return Object.keys(errores).length ? errores : null;
  };
}

/**
 * Marca un campo en rojo cuando es inválido por sí mismo o cuando el grupo tiene alguno de los
 * errores cruzados que le conciernen, para mostrar el `mat-error` junto al campo afectado.
 */
export class ErrorCruzadoMatcher implements ErrorStateMatcher {
  constructor(private readonly claves: readonly string[]) {}

  isErrorState(control: AbstractControl | null, form: FormGroupDirective | NgForm | null): boolean {
    if (!control) return false;
    const grupo = control.parent;
    const cruzado = this.claves.some((clave) => grupo?.hasError(clave) ?? false);
    return (control.invalid || cruzado) && (control.touched || control.dirty || !!form?.submitted);
  }
}
