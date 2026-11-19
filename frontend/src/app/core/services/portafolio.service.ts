import { HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  map,
  Observable,
  of,
  shareReplay,
  tap,
} from 'rxjs';

import {
  FiltrosPortafolio,
  FiltrosPosicion,
  FormatoExportacion,
  MetricasPortafolio,
  Paginado,
  Pais,
  Portafolio,
  PortafolioActualizacion,
  PortafolioDetalle,
  PortafolioPayload,
  Posicion,
  PosicionPayload,
  ResumenPortafolio,
  VerificacionNombre,
} from '../models';
import { contextoSilencioso, contextoSinNotificacion } from '../interceptors/contexto-http';
import { calcularMetricas, catalogoRiesgo } from '../utils/metricas-portafolio';
import { ApiService } from './api.service';
import { PaisService } from './pais.service';

/**
 * Portafolios: API REST + estado reactivo del portafolio abierto.
 * Las métricas (monto total activo, riesgo promedio ponderado, distribuciones) se recalculan en el
 * cliente cada vez que cambian las posiciones, sin esperar a que el backend las vuelva a enviar.
 */
@Injectable({ providedIn: 'root' })
export class PortafolioService {
  private readonly api = inject(ApiService);
  private readonly paisService = inject(PaisService);

  private readonly portafolioSubject = new BehaviorSubject<PortafolioDetalle | null>(null);
  private readonly paisesSubject = new BehaviorSubject<Pais[]>([]);
  private paisesCache$: Observable<Pais[]> | null = null;

  /** Portafolio actualmente abierto (detalle). */
  readonly portafolio$: Observable<PortafolioDetalle | null> =
    this.portafolioSubject.asObservable();

  readonly posiciones$: Observable<Posicion[]> = this.portafolio$.pipe(
    map((p) => p?.posiciones ?? []),
  );

  /** Catálogo de países (con IRPC vigente) para autocompletar y ponderar el riesgo. */
  readonly paises$: Observable<Pais[]> = this.paisesSubject.asObservable();

  /** Métricas derivadas en tiempo real de `posiciones$` + IRPC de cada país. */
  readonly metricas$: Observable<MetricasPortafolio> = combineLatest([
    this.posiciones$,
    this.paises$.pipe(map(catalogoRiesgo)),
  ]).pipe(
    map(([posiciones, catalogo]) => calcularMetricas(posiciones, catalogo)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  get portafolioActual(): PortafolioDetalle | null {
    return this.portafolioSubject.value;
  }

  get paisesActuales(): Pais[] {
    return this.paisesSubject.value;
  }

  // ---- Estado -------------------------------------------------------------------------------

  /** Carga el detalle y el catálogo de países y los publica como estado actual. */
  abrir(id: number): Observable<PortafolioDetalle> {
    return forkJoin([this.obtener(id), this.cargarPaises()]).pipe(
      map(([detalle]) => detalle),
      tap((detalle) => this.portafolioSubject.next(detalle)),
    );
  }

  cerrar(): void {
    this.portafolioSubject.next(null);
  }

  /** Catálogo de países, solicitado una sola vez por sesión de la aplicación. */
  cargarPaises(): Observable<Pais[]> {
    if (this.paisesSubject.value.length) {
      return of(this.paisesSubject.value);
    }
    this.paisesCache$ ??= this.paisService.listarTodos().pipe(
      tap({
        next: (paises) => this.paisesSubject.next(paises),
        error: () => (this.paisesCache$ = null),
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.paisesCache$;
  }

  // ---- Portafolios --------------------------------------------------------------------------

  listar(filtros: FiltrosPortafolio = {}): Observable<Paginado<Portafolio>> {
    return this.api.get<Paginado<Portafolio>>('portafolios/', { params: filtros });
  }

  obtener(id: number): Observable<PortafolioDetalle> {
    return this.api.get<PortafolioDetalle>(`portafolios/${id}/`);
  }

  /** Sin snackbar global: el formulario muestra los errores de validación en cada campo. */
  crear(datos: PortafolioPayload): Observable<Portafolio> {
    return this.api.post<Portafolio>('portafolios/', datos, {
      contexto: contextoSinNotificacion(),
    });
  }

  /**
   * Requiere `fecha_modificacion` (bloqueo optimista); responde 409 si otro usuario lo modificó.
   * Sin snackbar global: el formulario presenta el conflicto con opciones de resolución.
   */
  actualizar(id: number, datos: PortafolioActualizacion): Observable<PortafolioDetalle> {
    return this.api
      .put<PortafolioDetalle>(`portafolios/${id}/`, datos, { contexto: contextoSinNotificacion() })
      .pipe(tap((detalle) => this.publicarSiAbierto(detalle)));
  }

  /** Soft delete (`activo = false`). */
  eliminar(id: number): Observable<void> {
    return this.api.delete<void>(`portafolios/${id}/`).pipe(
      tap(() => {
        if (this.portafolioActual?.id === id) this.cerrar();
      }),
    );
  }

  resumen(id: number): Observable<ResumenPortafolio> {
    return this.api.get<ResumenPortafolio>(`portafolios/${id}/resumen/`);
  }

  /** Validación asíncrona del nombre; silenciosa para no mostrar spinner ni snackbar al teclear. */
  verificarNombre(nombre: string, excluirId?: number): Observable<VerificacionNombre> {
    return this.api.get<VerificacionNombre>('portafolios/verificar-nombre/', {
      params: { nombre, excluir: excluirId },
      contexto: contextoSilencioso(),
    });
  }

  exportar(id: number, formato: FormatoExportacion): Observable<HttpResponse<Blob>> {
    return this.api.descargar(`portafolios/${id}/export/${formato}/`);
  }

  // ---- Posiciones (actualizan el estado local → métricas en tiempo real) -------------------

  posiciones(portafolioId: number, filtros: FiltrosPosicion = {}): Observable<Paginado<Posicion>> {
    return this.api.get<Paginado<Posicion>>(`portafolios/${portafolioId}/posiciones/`, {
      params: filtros,
    });
  }

  agregarPosicion(portafolioId: number, datos: PosicionPayload): Observable<Posicion> {
    return this.api
      .post<Posicion>(`portafolios/${portafolioId}/posiciones/`, datos, {
        contexto: contextoSinNotificacion(),
      })
      .pipe(tap((p) => this.mutarPosiciones(portafolioId, (lista) => [p, ...lista])));
  }

  editarPosicion(
    portafolioId: number,
    posicionId: number,
    datos: PosicionPayload,
  ): Observable<Posicion> {
    return this.api
      .put<Posicion>(`portafolios/${portafolioId}/posiciones/${posicionId}/`, datos, {
        contexto: contextoSinNotificacion(),
      })
      .pipe(tap((p) => this.reemplazarPosicion(portafolioId, p)));
  }

  /** Cierra la posición (el backend fija `fecha_salida` = hoy). */
  cerrarPosicion(portafolioId: number, posicionId: number): Observable<Posicion> {
    return this.api
      .delete<Posicion>(`portafolios/${portafolioId}/posiciones/${posicionId}/`)
      .pipe(tap((p) => this.reemplazarPosicion(portafolioId, p)));
  }

  private reemplazarPosicion(portafolioId: number, posicion: Posicion): void {
    this.mutarPosiciones(portafolioId, (lista) =>
      lista.map((p) => (p.id === posicion.id ? posicion : p)),
    );
  }

  private mutarPosiciones(portafolioId: number, cambio: (lista: Posicion[]) => Posicion[]): void {
    const actual = this.portafolioActual;
    if (actual?.id !== portafolioId) return;
    const posiciones = cambio(actual.posiciones);
    const activas = posiciones.filter((p) => p.fecha_salida === null);
    this.portafolioSubject.next({
      ...actual,
      posiciones,
      posiciones_activas: activas.length,
      monto_total_activo: activas.reduce((s, p) => s + Number(p.monto_inversion_usd), 0),
    });
  }

  private publicarSiAbierto(detalle: PortafolioDetalle): void {
    if (this.portafolioActual?.id === detalle.id) {
      this.portafolioSubject.next(detalle);
    }
  }
}
