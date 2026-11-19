import { HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  FiltrosHistorico,
  FiltrosRanking,
  IndiceRiesgoBase,
  Paginado,
  RankingRiesgo,
  ResultadoRecalculo,
  RiesgoDetalle,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class RiesgoService {
  private readonly api = inject(ApiService);

  /** Ranking por IRPC del último cálculo de cada país. */
  ranking(filtros: FiltrosRanking = {}): Observable<Paginado<RankingRiesgo>> {
    return this.api.get<Paginado<RankingRiesgo>>('riesgo/', { params: filtros });
  }

  /** `contexto` permite, p. ej., silenciar el snackbar cuando un país aún no tiene IRPC (404). */
  detalle(codigoIso: string, contexto?: HttpContext): Observable<RiesgoDetalle> {
    return this.api.get<RiesgoDetalle>(`riesgo/${this.iso(codigoIso)}/`, { contexto });
  }

  historico(
    codigoIso: string,
    filtros: FiltrosHistorico = {},
  ): Observable<Paginado<IndiceRiesgoBase>> {
    return this.api.get<Paginado<IndiceRiesgoBase>>(`riesgo/${this.iso(codigoIso)}/historico/`, {
      params: filtros,
    });
  }

  /** Solo ADMIN. */
  recalcular(): Observable<ResultadoRecalculo> {
    return this.api.post<ResultadoRecalculo>('riesgo/calcular/', null);
  }

  private iso(codigo: string): string {
    return encodeURIComponent(codigo.trim().toUpperCase());
  }
}
