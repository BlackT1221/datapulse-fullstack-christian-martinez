import { HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  FiltrosPortafolio,
  FiltrosPosicion,
  FormatoExportacion,
  Paginado,
  Portafolio,
  PortafolioActualizacion,
  PortafolioDetalle,
  PortafolioPayload,
  Posicion,
  PosicionPayload,
  ResumenPortafolio,
  VerificacionNombre,
} from '../models';
import { contextoSilencioso } from '../interceptors/contexto-http';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PortafolioService {
  private readonly api = inject(ApiService);

  listar(filtros: FiltrosPortafolio = {}): Observable<Paginado<Portafolio>> {
    return this.api.get<Paginado<Portafolio>>('portafolios/', { params: filtros });
  }

  obtener(id: number): Observable<PortafolioDetalle> {
    return this.api.get<PortafolioDetalle>(`portafolios/${id}/`);
  }

  crear(datos: PortafolioPayload): Observable<Portafolio> {
    return this.api.post<Portafolio>('portafolios/', datos);
  }

  /** Requiere `fecha_modificacion` (bloqueo optimista); responde 409 si otro usuario lo modificó. */
  actualizar(id: number, datos: PortafolioActualizacion): Observable<PortafolioDetalle> {
    return this.api.put<PortafolioDetalle>(`portafolios/${id}/`, datos);
  }

  /** Soft delete (`activo = false`). */
  eliminar(id: number): Observable<void> {
    return this.api.delete<void>(`portafolios/${id}/`);
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

  posiciones(portafolioId: number, filtros: FiltrosPosicion = {}): Observable<Paginado<Posicion>> {
    return this.api.get<Paginado<Posicion>>(`portafolios/${portafolioId}/posiciones/`, {
      params: filtros,
    });
  }

  agregarPosicion(portafolioId: number, datos: PosicionPayload): Observable<Posicion> {
    return this.api.post<Posicion>(`portafolios/${portafolioId}/posiciones/`, datos);
  }

  editarPosicion(
    portafolioId: number,
    posicionId: number,
    datos: PosicionPayload,
  ): Observable<Posicion> {
    return this.api.put<Posicion>(`portafolios/${portafolioId}/posiciones/${posicionId}/`, datos);
  }

  /** Cierra la posición (el backend fija `fecha_salida` = hoy). */
  cerrarPosicion(portafolioId: number, posicionId: number): Observable<Posicion> {
    return this.api.delete<Posicion>(`portafolios/${portafolioId}/posiciones/${posicionId}/`);
  }

  exportar(id: number, formato: FormatoExportacion): Observable<HttpResponse<Blob>> {
    return this.api.descargar(`portafolios/${id}/export/${formato}/`);
  }
}
