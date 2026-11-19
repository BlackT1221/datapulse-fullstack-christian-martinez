import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  map,
  Observable,
  Subject,
  switchMap,
  tap,
} from 'rxjs';

import { contextoSilencioso } from '../interceptors/contexto-http';
import {
  Alerta,
  FiltrosAlerta,
  Paginado,
  ResultadoLeerTodas,
  ResumenAlertas,
  Severidad,
} from '../models';
import { ApiService } from './api.service';

export const INTERVALO_POLLING_MS = 30_000;
export const TAMANO_PAGINA_ALERTAS = 20;

export interface EstadoAlertas {
  alertas: Alerta[];
  total: number;
  filtros: FiltrosAlerta;
  cargando: boolean;
  error: boolean;
}

const ESTADO_INICIAL: EstadoAlertas = {
  alertas: [],
  total: 0,
  filtros: { page: 1, page_size: TAMANO_PAGINA_ALERTAS },
  cargando: false,
  error: false,
};

/**
 * Alertas del usuario con estado compartido:
 * - `estado$`: página actual del panel (filtros, resultados, carga/error).
 * - `resumen$` / `noLeidas$`: conteos para el badge del navbar, refrescados por polling.
 * Marcar como leída actualiza ambos estados de inmediato (optimista) y revierte si falla.
 */
@Injectable({ providedIn: 'root' })
export class AlertaService {
  private readonly api = inject(ApiService);

  private readonly estadoSubject = new BehaviorSubject<EstadoAlertas>(ESTADO_INICIAL);
  private readonly resumenSubject = new BehaviorSubject<ResumenAlertas | null>(null);
  private readonly nuevasSubject = new BehaviorSubject<boolean>(false);
  private readonly solicitudes = new Subject<FiltrosAlerta>();

  readonly estado$: Observable<EstadoAlertas> = this.estadoSubject.asObservable();
  readonly resumen$: Observable<ResumenAlertas | null> = this.resumenSubject.asObservable();
  readonly noLeidas$: Observable<number> = this.resumen$.pipe(
    map((r) => r?.no_leidas ?? 0),
    distinctUntilChanged(),
  );
  /** `true` cuando el polling detecta alertas creadas después de la última carga del panel. */
  readonly hayNuevas$: Observable<boolean> = this.nuevasSubject.asObservable();

  constructor() {
    // `switchMap` descarta respuestas obsoletas si los filtros cambian rápidamente.
    this.solicitudes
      .pipe(
        switchMap((filtros) =>
          this.listar(filtros).pipe(
            tap((pagina) => {
              this.nuevasSubject.next(false);
              this.parchar({ alertas: pagina.results, total: pagina.count, cargando: false });
            }),
            catchError(() => {
              this.parchar({ cargando: false, error: true });
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  /** Carga la página del panel combinando los filtros dados con los vigentes. */
  cargar(cambios: Partial<FiltrosAlerta> = {}): void {
    const filtros = { ...this.estadoSubject.value.filtros, ...cambios };
    this.parchar({ filtros, cargando: true, error: false });
    this.solicitudes.next(filtros);
  }

  listar(filtros: FiltrosAlerta = {}): Observable<Paginado<Alerta>> {
    return this.api.get<Paginado<Alerta>>('alertas/', { params: filtros });
  }

  leer(alerta: Alerta): Observable<Alerta> {
    this.marcarLocal((a) => a.id === alerta.id);
    this.descontar([alerta]);
    return this.api.put<Alerta>(`alertas/${alerta.id}/leer/`, null).pipe(
      tap({ error: () => this.resincronizar() }),
    );
  }

  leerTodas(): Observable<ResultadoLeerTodas> {
    const previo = this.estadoSubject.value;
    this.marcarLocal(() => true);
    const resumen = this.resumenSubject.value;
    if (resumen) {
      this.resumenSubject.next({
        ...resumen,
        no_leidas: 0,
        no_leidas_por_severidad: { INFO: 0, WARNING: 0, CRITICAL: 0 },
      });
    }
    return this.api.put<ResultadoLeerTodas>('alertas/leer-todas/', null).pipe(
      tap({
        next: () => {
          if (previo.filtros.leida === false) this.cargar({ page: 1 });
        },
        error: () => this.resincronizar(),
      }),
    );
  }

  /** Conteos por tipo/severidad. `silencioso` omite spinner y snackbar (polling). */
  consultarResumen(silencioso = false): Observable<ResumenAlertas> {
    return this.api
      .get<ResumenAlertas>('alertas/resumen/', silencioso ? { contexto: contextoSilencioso() } : {})
      .pipe(
        tap((r) => {
          const anterior = this.resumenSubject.value;
          if (anterior && r.total > anterior.total) this.nuevasSubject.next(true);
          this.resumenSubject.next(r);
        }),
      );
  }

  /** Limpia el estado al cerrar sesión para no mostrar datos de otro usuario. */
  reiniciar(): void {
    this.estadoSubject.next(ESTADO_INICIAL);
    this.resumenSubject.next(null);
    this.nuevasSubject.next(false);
  }

  private parchar(cambios: Partial<EstadoAlertas>): void {
    this.estadoSubject.next({ ...this.estadoSubject.value, ...cambios });
  }

  private marcarLocal(criterio: (a: Alerta) => boolean): void {
    const alertas = this.estadoSubject.value.alertas.map((a) =>
      !a.leida && criterio(a) ? { ...a, leida: true } : a,
    );
    this.parchar({ alertas });
  }

  private descontar(alertas: Alerta[]): void {
    const resumen = this.resumenSubject.value;
    const pendientes = alertas.filter((a) => !a.leida);
    if (!resumen || !pendientes.length) return;
    const porSeveridad: Record<Severidad, number> = { ...resumen.no_leidas_por_severidad };
    for (const a of pendientes) porSeveridad[a.severidad] = Math.max(0, porSeveridad[a.severidad] - 1);
    this.resumenSubject.next({
      ...resumen,
      no_leidas: Math.max(0, resumen.no_leidas - pendientes.length),
      no_leidas_por_severidad: porSeveridad,
    });
  }

  private resincronizar(): void {
    this.cargar();
    this.consultarResumen(true)
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }
}
