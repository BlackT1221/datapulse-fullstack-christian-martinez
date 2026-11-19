import { Component, computed, input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { ETIQUETAS_INDICADOR, IndicadorEconomico, TipoIndicador } from '../../../../core/models';
import {
  datasetLinea,
  opcionesLinea,
  pluginCrosshair,
  SERIES,
} from '../../../../shared/charts/tema-graficos';
import { EstadoCargaComponent } from '../../../../shared/components/estado-carga/estado-carga.component';
import { formatearIndicador } from '../../../../shared/pipes';

const ANIOS = 5;

/** Histórico de un indicador (últimos 5 años). Un indicador a la vez: unidades distintas, un solo eje. */
@Component({
  selector: 'app-grafico-indicadores',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    BaseChartDirective,
    EstadoCargaComponent,
  ],
  template: `
    <mat-card appearance="outlined" class="tarjeta">
      <mat-card-header class="cabecera">
        <mat-card-title>Histórico de indicadores</mat-card-title>
        <mat-card-subtitle>Últimos {{ anios }} años disponibles · World Bank</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="selector">
          <mat-label>Indicador</mat-label>
          <mat-select [value]="tipo()" (valueChange)="tipo.set($event)">
            @for (item of opcionesTipo; track item.tipo) {
              <mat-option [value]="item.tipo">{{ item.etiqueta }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (datos(); as d) {
          <div class="lienzo">
            <canvas
              baseChart
              type="line"
              [data]="d"
              [options]="opciones()"
              [plugins]="plugins"
              role="img"
              [attr.aria-label]="'Histórico de ' + etiqueta()"
            ></canvas>
          </div>
        } @else {
          <app-estado-carga
            [vacio]="true"
            mensajeVacio="Sin datos históricos para este indicador."
          />
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .tarjeta {
      height: 100%;
    }
    .selector {
      width: 240px;
      max-width: 100%;
      margin: 0.75rem 0 1rem;
    }
    .lienzo {
      position: relative;
      height: 300px;
    }
  `,
})
export class GraficoIndicadoresComponent {
  readonly indicadores = input.required<IndicadorEconomico[]>();

  protected readonly anios = ANIOS;
  protected readonly plugins = [pluginCrosshair];
  protected readonly tipo = signal<TipoIndicador>('PIB_PERCAPITA');
  protected readonly opcionesTipo = (Object.keys(ETIQUETAS_INDICADOR) as TipoIndicador[]).map(
    (tipo) => ({
      tipo,
      etiqueta: ETIQUETAS_INDICADOR[tipo],
    }),
  );
  protected readonly etiqueta = computed(() => ETIQUETAS_INDICADOR[this.tipo()]);

  private readonly serie = computed(() =>
    this.indicadores()
      .filter((i) => i.tipo === this.tipo())
      .sort((a, b) => a.anio - b.anio)
      .slice(-ANIOS),
  );

  protected readonly datos = computed<ChartData<'line', (number | null)[], string> | null>(() => {
    const serie = this.serie();
    if (!serie.length) return null;
    return {
      labels: serie.map((i) => String(i.anio)),
      datasets: [
        datasetLinea(
          this.etiqueta(),
          serie.map((i) => Number(i.valor)),
          SERIES[0],
        ),
      ],
    };
  });

  protected readonly opciones = computed(() => {
    const unidad = this.serie()[0]?.unidad ?? null;
    return opcionesLinea({ formatoY: (v) => formatearIndicador(v, unidad), leyenda: false });
  });
}
