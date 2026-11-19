import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { catchError, debounceTime, first, map, Observable, of, startWith, switchMap } from 'rxjs';

import { NOMBRE_PORTAFOLIO_MIN } from '../../../core/models';
import { PortafolioService } from '../../../core/services/portafolio.service';

export const DEBOUNCE_NOMBRE_MS = 400;

/**
 * Valida contra la API que el usuario no tenga otro portafolio con el mismo nombre.
 * `debounceTime(400)` sobre `valueChanges` espera a que el usuario deje de escribir; Angular
 * cancela la suscripción anterior en cada tecla, así que solo viaja la última consulta.
 * Un fallo de red no bloquea el formulario: el backend vuelve a validar al guardar.
 */
export function nombreUnicoValidator(
  service: PortafolioService,
  excluirId: () => number | undefined,
): AsyncValidatorFn {
  return (control: AbstractControl<string>): Observable<ValidationErrors | null> => {
    const consultar = (valor: string): Observable<ValidationErrors | null> => {
      const nombre = (valor ?? '').trim();
      if (nombre.length < NOMBRE_PORTAFOLIO_MIN) return of(null);
      return service.verificarNombre(nombre, excluirId()).pipe(
        map((r) =>
          r.disponible
            ? null
            : { nombreDuplicado: r.mensaje ?? 'Ya tienes un portafolio con este nombre.' },
        ),
        catchError(() => of(null)),
      );
    };
    return control.valueChanges.pipe(
      startWith(control.value),
      debounceTime(DEBOUNCE_NOMBRE_MS),
      first(),
      switchMap(consultar),
    );
  };
}
