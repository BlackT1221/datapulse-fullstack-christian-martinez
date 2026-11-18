import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { TipoCambio } from '../../../../core/models';
import {
  datasetLinea,
  opcionesLinea,
  pluginCrosshair,
  SERIES,
} from '../../../../shared/charts/tema-graficos';
import { EstadoCargaComponent } from '../../../../shared/components/estado-carga/estado-carga.component';
import { PorcentajePipe } from '../../../../shared/pipes';
import { LOCALE } from '../../../../shared/pipes/numero';

const FORMATO_FECHA = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function formatoTasa(valor: number): string {
  const decimales = Math.abs(valor) >= 100 ? 2 : 4;
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: decimales }).format(valor);
}

/** Tasa diaria (moneda local por 1 USD) de los últimos 30 días. Subir = depreciación local. */
@Component({
  selector: 'app-grafico-tipo-cambio',
  imports: [MatCardModule, MatIconModule, BaseChartDirective, EstadoCargaComponent, PorcentajePipe],
  templateUrl: './grafico-tipo-cambio.component.html',
  styleUrl: './grafico-tipo-cambio.component.scss',
})
export class GraficoTipoCambioComponent {
  readonly serie = input.required<TipoCambio[]>();
  readonly moneda = input.required<string>();

  protected readonly plugins = [pluginCrosshair];
  protected readonly dolarizado = computed(() => this.moneda() === 'USD');
  protected readonly ultimo = computed(() => this.serie().at(-1) ?? null);
  protected readonly tasaActual = computed(() => {
    const ultimo = this.ultimo();
    return ultimo ? formatoTasa(Number(ultimo.tasa)) : null;
  });

  /** Variación acumulada del periodo mostrado (primer → último registro). */
  protected readonly variacionPeriodo = computed(() => {
    const serie = this.serie();
    const inicio = Number(serie[0]?.tasa);
    const fin = Number(serie.at(-1)?.tasa);
    return serie.length >= 2 && inicio ? ((fin - inicio) / inicio) * 100 : null;
  });

  protected readonly datos = computed<ChartData<'line', (number | null)[], string> | null>(() => {
    const serie = this.serie();
    if (serie.length < 2) return null;
    return {
      labels: serie.map((t) => FORMATO_FECHA.format(new Date(`${t.fecha}T00:00:00Z`))),
      datasets: [
        datasetLinea(
          `${this.moneda()} por USD`,
          serie.map((t) => Number(t.tasa)),
          SERIES[0],
        ),
      ],
    };
  });

  protected readonly opciones = opcionesLinea({
    formatoY: formatoTasa,
    leyenda: false,
    radioPunto: 0,
    maxTicksX: 6,
  });
}
