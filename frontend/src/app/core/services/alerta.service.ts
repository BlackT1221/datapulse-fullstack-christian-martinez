import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  EMPTY,
  Observable,
  Subscription,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { contextoSilencioso } from '../interceptors/contexto-http';
import { Alerta, FiltrosAlerta, Paginado, ResultadoLeerTodas, ResumenAlertas } from '../models';
import { ApiService } from './api.service';

export const INTERVALO_POLLING_MS = 30_000;

/** Alertas del usuario + estado compartido del conteo de no leídas (badge del navbar). */
@Injectable({ providedIn: 'root' })
export class AlertaService {
  private readonly api = inject(ApiService);
  private readonly noLeidasSubject = new BehaviorSubject<number>(0);
  private polling: Subscription | null = null;

  readonly noLeidas$: Observable<number> = this.noLeidasSubject.asObservable();

  listar(filtros: FiltrosAlerta = {}): Observable<Paginado<Alerta>> {
    return this.api.get<Paginado<Alerta>>('alertas/', { params: filtros });
  }

  leer(id: number): Observable<Alerta> {
    return this.api
      .put<Alerta>(`alertas/${id}/leer/`, null)
      .pipe(tap(() => this.actualizarConteo()));
  }

  leerTodas(): Observable<ResultadoLeerTodas> {
    return this.api
      .put<ResultadoLeerTodas>('alertas/leer-todas/', null)
      .pipe(tap(() => this.noLeidasSubject.next(0)));
  }

  resumen(silencioso = false): Observable<ResumenAlertas> {
    return this.api
      .get<ResumenAlertas>('alertas/resumen/', silencioso ? { contexto: contextoSilencioso() } : {})
      .pipe(tap((r) => this.noLeidasSubject.next(r.no_leidas)));
  }

  /** Consulta el resumen cada 30 s sin spinner ni snackbar. Idempotente. */
  iniciarPolling(intervaloMs = INTERVALO_POLLING_MS): void {
    if (this.polling) {
      return;
    }
    this.polling = timer(0, intervaloMs)
      .pipe(switchMap(() => this.resumen(true).pipe(catchError(() => EMPTY))))
      .subscribe();
  }

  detenerPolling(): void {
    this.polling?.unsubscribe();
    this.polling = null;
    this.noLeidasSubject.next(0);
  }

  private actualizarConteo(): void {
    this.resumen(true)
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }
}
