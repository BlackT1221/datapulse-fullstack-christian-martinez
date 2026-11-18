import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { NIVELES_RIESGO, ResumenDashboard } from '../../../core/models';

@Component({
  selector: 'app-kpi-cards',
  imports: [DatePipe, DecimalPipe, MatCardModule, MatIconModule],
  templateUrl: './kpi-cards.component.html',
  styleUrl: './kpi-cards.component.scss',
})
export class KpiCardsComponent {
  readonly resumen = input.required<ResumenDashboard>();

  protected readonly nivelPromedio = computed(() => {
    const nivel = this.resumen().nivel_promedio;
    return nivel ? NIVELES_RIESGO[nivel] : null;
  });
}
