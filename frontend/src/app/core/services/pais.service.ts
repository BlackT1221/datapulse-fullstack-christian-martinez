import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  FiltrosIndicador,
  FiltrosPais,
  FiltrosTipoCambio,
  IndicadorEconomico,
  Paginado,
  Pais,
  PaisDetalle,
  ResultadoSincronizacion,
  TipoCambio,
} from '../models';
import { ApiService } from './api.service';

const TAMANO_MAXIMO = 100;

@Injectable({ providedIn: 'root' })
export class PaisService {
  private readonly api = inject(ApiService);

  listar(filtros: FiltrosPais = {}): Observable<Paginado<Pais>> {
    return this.api.get<Paginado<Pais>>('paises/', { params: filtros });
  }

  /** Todos los países activos en una sola página (catálogo de 10 países). */
  listarTodos(): Observable<Pais[]> {
    return this.listar({ activo: true, page_size: TAMANO_MAXIMO }).pipe(map((p) => p.results));
  }

  obtener(codigoIso: string): Observable<PaisDetalle> {
    return this.api.get<PaisDetalle>(`paises/${this.iso(codigoIso)}/`);
  }

  indicadores(
    codigoIso: string,
    filtros: FiltrosIndicador = {},
  ): Observable<Paginado<IndicadorEconomico>> {
    return this.api.get<Paginado<IndicadorEconomico>>(
      `paises/${this.iso(codigoIso)}/indicadores/`,
      {
        params: filtros,
      },
    );
  }

  tipoCambio(codigoIso: string, filtros: FiltrosTipoCambio = {}): Observable<Paginado<TipoCambio>> {
    return this.api.get<Paginado<TipoCambio>>(`paises/${this.iso(codigoIso)}/tipo-cambio/`, {
      params: filtros,
    });
  }

  /** Solo ADMIN: sincroniza World Bank + ExchangeRate-API y recalcula el IRPC. */
  sincronizarIndicadores(): Observable<ResultadoSincronizacion> {
    return this.api.post<ResultadoSincronizacion>('paises/sync-indicadores/', null);
  }

  private iso(codigo: string): string {
    return encodeURIComponent(codigo.trim().toUpperCase());
  }
}
