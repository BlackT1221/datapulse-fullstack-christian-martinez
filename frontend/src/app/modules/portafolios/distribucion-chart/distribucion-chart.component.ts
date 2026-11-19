import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { opcionesDistribucion, SegmentoDistribucion } from '../../../shared/charts/tema-distribucion';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';
import { MonedaUsdPipe } from '../../../shared/pipes';

const formatoUsd = new MonedaUsdPipe();

/**
 * Distribución del monto activo en Pie (`pie`) o Donut (`doughnut`). La leyenda es también la
 * vista de tabla: nombre, monto y porcentaje, para no depender solo del color.
 */
@Component({
  selector: 'app-distribucion-chart',
  imports: [DecimalPipe, MatCardModule, BaseChartDirective, EstadoCargaComponent, MonedaUsdPipe],
  templateUrl: './distribucion-chart.component.html',
  styleUrl: './distribucion-chart.component.scss',
})
export class DistribucionChartComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  readonly tipo = input<'pie' | 'doughnut'>('pie');
  readonly segmentos = input.required<readonly SegmentoDistribucion[]>();
  /** Total mostrado en el centro del donut. */
  readonly total = input<number | null>(null);

  protected readonly datos = computed<ChartData<'pie' | 'doughnut', number[], string>>(() => {
    const segmentos = this.segmentos();
    return {
      labels: segmentos.map((s) => s.etiqueta),
      datasets: [
        {
          data: segmentos.map((s) => s.monto),
          backgroundColor: segmentos.map((s) => s.color),
          hoverBackgroundColor: segmentos.map((s) => s.color),
        },
      ],
    };
  });

  protected readonly opciones = computed(() =>
    opcionesDistribucion(this.tipo(), () => this.segmentos(), (v) => formatoUsd.transform(v)),
  );

  protected readonly descripcion = computed(() =>
    this.segmentos()
      .map((s) => `${s.etiqueta} ${s.porcentaje.toLocaleString('es-CO')} %`)
      .join(', '),
  );
}
