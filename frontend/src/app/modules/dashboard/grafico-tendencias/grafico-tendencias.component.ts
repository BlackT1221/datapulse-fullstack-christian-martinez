import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { map } from 'rxjs';

import {
  ETIQUETAS_INDICADOR,
  PaisMapa,
  TipoIndicador,
  TendenciasDashboard,
} from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';
import {
  datasetLinea,
  opcionesLinea,
  pluginCrosshair,
  SERIES,
} from '../../../shared/charts/tema-graficos';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';
import { formatearIndicador, ValorIndicadorPipe } from '../../../shared/pipes';
import { asignarSlots } from './slots';

export const MAX_PAISES_TENDENCIA = 3;
const PAISES_INICIALES = ['CO', 'BR', 'MX'];

const entreUnoYTres: ValidatorFn = (control) => {
  const valor: unknown = control.value;
  const cantidad = Array.isArray(valor) ? valor.length : 0;
  if (cantidad === 0) return { required: true };
  return cantidad > MAX_PAISES_TENDENCIA ? { maxPaises: true } : null;
};

@Component({
  selector: 'app-grafico-tendencias',
  imports: [
    ReactiveFormsModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    BaseChartDirective,
    EstadoCargaComponent,
    ValorIndicadorPipe,
  ],
  templateUrl: './grafico-tendencias.component.html',
  styleUrl: './grafico-tendencias.component.scss',
})
export class GraficoTendenciasComponent {
  private readonly dashboard = inject(DashboardService);

  readonly paises = input.required<PaisMapa[]>();

  protected readonly maximo = MAX_PAISES_TENDENCIA;
  protected readonly plugins = [pluginCrosshair];
  protected readonly vista = signal<'grafico' | 'tabla'>('grafico');
  protected readonly indicadores = (Object.keys(ETIQUETAS_INDICADOR) as TipoIndicador[]).map(
    (tipo) => ({
      tipo,
      etiqueta: ETIQUETAS_INDICADOR[tipo],
    }),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo: ['PIB_PERCAPITA' as TipoIndicador, Validators.required],
    paises: [PAISES_INICIALES, entreUnoYTres],
  });

  private readonly seleccion = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** Slot de color por país: un país conserva su color aunque cambie el resto de la selección. */
  private readonly slots = linkedSignal<string[], Readonly<Record<string, number>>>({
    source: () => this.seleccion().paises,
    computation: (paises, previo) => asignarSlots(previo?.value ?? {}, paises),
  });

  protected readonly tendencias = rxResource({
    params: () => (this.form.valid ? this.seleccion() : undefined),
    stream: ({ params }) =>
      this.dashboard.tendencias({ tipo: params.tipo, paises: params.paises.join(','), anios: 5 }),
  });

  protected readonly datos = computed<ChartData<'line', (number | null)[], string> | null>(() => {
    if (!this.tendencias.hasValue()) return null;
    const t = this.tendencias.value();
    const slots = this.slots();
    return {
      labels: t.anios.map(String),
      datasets: t.series.map((s) => datasetLinea(s.nombre, s.valores, SERIES[slots[s.pais] ?? 0])),
    };
  });

  protected readonly opciones = computed(() => {
    const unidad = this.tendencias.hasValue() ? this.tendencias.value().unidad : null;
    return opcionesLinea({ formatoY: (v) => formatearIndicador(v, unidad), leyenda: true });
  });

  protected colorDe(codigo: string): string {
    return SERIES[this.slots()[codigo] ?? 0];
  }

  protected seleccionLlena(codigo: string): boolean {
    const actuales = this.form.controls.paises.value;
    return actuales.length >= MAX_PAISES_TENDENCIA && !actuales.includes(codigo);
  }

  protected sinDatos(t: TendenciasDashboard): boolean {
    return t.anios.length === 0 || t.series.every((s) => s.valores.every((v) => v === null));
  }
}
