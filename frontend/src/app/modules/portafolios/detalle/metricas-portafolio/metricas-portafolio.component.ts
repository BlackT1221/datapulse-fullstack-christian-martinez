import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { MetricasPortafolio, NIVELES_RIESGO } from '../../../../core/models';
import { MonedaUsdPipe } from '../../../../shared/pipes';

/** KPIs del portafolio, recalculados en el cliente cada vez que cambian sus posiciones. */
@Component({
  selector: 'app-metricas-portafolio',
  imports: [DecimalPipe, MatCardModule, MatIconModule, MatProgressBarModule, MonedaUsdPipe],
  templateUrl: './metricas-portafolio.component.html',
  styleUrl: './metricas-portafolio.component.scss',
})
export class MetricasPortafolioComponent {
  readonly metricas = input.required<MetricasPortafolio>();

  protected readonly nivel = computed(() => {
    const nivel = this.metricas().nivel_riesgo;
    return nivel ? NIVELES_RIESGO[nivel] : null;
  });

  protected readonly usoLimite = computed(() => {
    const m = this.metricas();
    return m.limite_monto_activo ? Math.min(100, (m.monto_total_activo / m.limite_monto_activo) * 100) : 0;
  });
}
