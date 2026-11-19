import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Correo con dominio y TLD (más estricto que `Validators.email`). */
export const emailValido: ValidatorFn = (control: AbstractControl<string>) => {
  const valor = control.value?.trim();
  return !valor || PATRON_EMAIL.test(valor) ? null : { email: true };
};

/** Replica `NumericPasswordValidator` de Django. */
export const noSoloNumeros: ValidatorFn = (control: AbstractControl<string>) =>
  control.value && /^\d+$/.test(control.value) ? { soloNumeros: true } : null;

/** Rechaza valores compuestos solo por espacios. */
export const sinSoloEspacios: ValidatorFn = (control: AbstractControl<string>) =>
  control.value && control.value.trim().length === 0 ? { required: true } : null;

/** El control debe coincidir con el control hermano `campo` (p. ej. confirmación de contraseña). */
export function igualA(campo: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const otro = control.parent?.get(campo);
    if (!otro || !control.value) {
      return null;
    }
    return control.value === otro.value ? null : { noCoincide: true };
  };
}

/** La fecha (`Date`) no puede ser posterior a hoy. */
export const fechaNoFutura: ValidatorFn = (control: AbstractControl<Date | null>) => {
  const valor = control.value;
  if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) {
    return null;
  }
  const finDeHoy = new Date();
  finDeHoy.setHours(23, 59, 59, 999);
  return valor.getTime() > finDeHoy.getTime() ? { fechaFutura: true } : null;
};

/**
 * Para `MatAutocomplete`: el valor debe ser una opción seleccionada (objeto), no texto libre.
 * Un texto escrito sin elegir opción produce `{ seleccionInvalida: true }`.
 */
export const opcionSeleccionada: ValidatorFn = (control: AbstractControl<unknown>) => {
  const valor = control.value;
  return typeof valor === 'string' && valor.trim() !== '' ? { seleccionInvalida: true } : null;
};
