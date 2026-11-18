import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Observable, of, switchMap, timer } from 'rxjs';

/** Retardo antes de mostrar el indicador, para evitar parpadeos en respuestas rápidas. */
const RETARDO_MS = 150;

/** Contador de solicitudes HTTP en curso expuesto como estado observable. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendientes = new BehaviorSubject<number>(0);

  readonly cargando$: Observable<boolean> = this.pendientes.pipe(
    map((n) => n > 0),
    distinctUntilChanged(),
    switchMap((cargando) => (cargando ? timer(RETARDO_MS).pipe(map(() => true)) : of(false))),
  );

  iniciar(): void {
    this.pendientes.next(this.pendientes.value + 1);
  }

  finalizar(): void {
    this.pendientes.next(Math.max(0, this.pendientes.value - 1));
  }
}
