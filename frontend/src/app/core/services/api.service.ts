import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface OpcionesSolicitud {
  /** Filtros/paginación; se omiten los valores `null`, `undefined` y cadenas vacías. */
  params?: object;
  contexto?: HttpContext;
}

/** Cliente HTTP base: resuelve URLs contra `environment.apiUrl` y normaliza query params. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  url(ruta: string): string {
    return `${this.baseUrl}/${ruta.replace(/^\/+/, '')}`;
  }

  /** Indica si una URL pertenece a esta API (para adjuntar el JWT solo a nuestro backend). */
  esUrlPropia(url: string): boolean {
    return url === this.baseUrl || url.startsWith(`${this.baseUrl}/`);
  }

  get<T>(ruta: string, opciones: OpcionesSolicitud = {}): Observable<T> {
    return this.http.get<T>(this.url(ruta), this.construir(opciones));
  }

  post<T>(ruta: string, cuerpo: object | null, opciones: OpcionesSolicitud = {}): Observable<T> {
    return this.http.post<T>(this.url(ruta), cuerpo, this.construir(opciones));
  }

  put<T>(ruta: string, cuerpo: object | null, opciones: OpcionesSolicitud = {}): Observable<T> {
    return this.http.put<T>(this.url(ruta), cuerpo, this.construir(opciones));
  }

  delete<T>(ruta: string, opciones: OpcionesSolicitud = {}): Observable<T> {
    return this.http.delete<T>(this.url(ruta), this.construir(opciones));
  }

  descargar(ruta: string, opciones: OpcionesSolicitud = {}): Observable<HttpResponse<Blob>> {
    return this.http.get(this.url(ruta), {
      ...this.construir(opciones),
      observe: 'response',
      responseType: 'blob',
    });
  }

  private construir(opciones: OpcionesSolicitud): { params: HttpParams; context?: HttpContext } {
    return { params: this.params(opciones.params), context: opciones.contexto };
  }

  private params(origen: object | undefined): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(origen ?? {})) {
      const tipo = typeof valor;
      if ((tipo === 'string' && valor !== '') || tipo === 'number' || tipo === 'boolean') {
        params = params.set(clave, String(valor));
      }
    }
    return params;
  }
}
