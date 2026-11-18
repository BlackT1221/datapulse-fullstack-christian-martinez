import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { DashboardService } from '../../core/services/dashboard.service';
import { RiesgoService } from '../../core/services/riesgo.service';
import { EstadoCargaComponent } from '../../shared/components/estado-carga/estado-carga.component';
import { GraficoTendenciasComponent } from './grafico-tendencias/grafico-tendencias.component';
import { KpiCardsComponent } from './kpi-cards/kpi-cards.component';
import { MapaRiesgoComponent } from './mapa-riesgo/mapa-riesgo.component';
import { TablaRankingComponent } from './tabla-ranking/tabla-ranking.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    EstadoCargaComponent,
    GraficoTendenciasComponent,
    KpiCardsComponent,
    MapaRiesgoComponent,
    TablaRankingComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly riesgo = inject(RiesgoService);

  protected readonly resumen = rxResource({ stream: () => this.dashboard.resumen() });
  protected readonly mapa = rxResource({ stream: () => this.dashboard.mapa() });
  protected readonly ranking = rxResource({
    stream: () => this.riesgo.ranking({ page_size: 20 }).pipe(map((p) => p.results)),
  });

  protected readonly paisesMapa = computed(() =>
    this.mapa.hasValue() ? this.mapa.value().paises : [],
  );

  protected actualizar(): void {
    this.resumen.reload();
    this.mapa.reload();
    this.ranking.reload();
  }
}
