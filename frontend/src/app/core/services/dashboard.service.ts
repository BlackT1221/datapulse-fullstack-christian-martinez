import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { FiltrosTendencias, MapaDashboard, ResumenDashboard, TendenciasDashboard } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  resumen(): Observable<ResumenDashboard> {
    return this.api.get<ResumenDashboard>('dashboard/resumen/');
  }

  mapa(): Observable<MapaDashboard> {
    return this.api.get<MapaDashboard>('dashboard/mapa/');
  }

  tendencias(filtros: FiltrosTendencias = {}): Observable<TendenciasDashboard> {
    return this.api.get<TendenciasDashboard>('dashboard/tendencias/', { params: filtros });
  }
}
