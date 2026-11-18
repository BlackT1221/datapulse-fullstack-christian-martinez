import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { EntradaIrpc, IndiceRiesgo, NIVELES_RIESGO } from '../../../../core/models';
import { formatearIndicador } from '../../../../shared/pipes';
import { COMPONENTES_IRPC, ETIQUETAS_ENTRADA, PESOS_POR_DEFECTO } from './componentes-irpc';

interface FilaEntrada {
  etiqueta: string;
  valor: string;
  penalizacion: number;
}

interface TarjetaScore {
  titulo: string;
  descripcion: string;
  score: number;
  peso: number;
  aporte: number;
  filas: FilaEntrada[];
}

@Component({
  selector: 'app-desglose-irpc',
  imports: [DatePipe, DecimalPipe, MatCardModule, MatIconModule],
  templateUrl: './desglose-irpc.component.html',
  styleUrl: './desglose-irpc.component.scss',
})
export class DesgloseIrpcComponent {
  readonly riesgo = input.required<IndiceRiesgo>();

  protected readonly nivel = computed(() => NIVELES_RIESGO[this.riesgo().nivel_riesgo]);
  protected readonly compuesto = computed(() => Number(this.riesgo().indice_compuesto));

  protected readonly tarjetas = computed<TarjetaScore[]>(() => {
    const r = this.riesgo();
    const detalle = r.detalle_calculo;
    return COMPONENTES_IRPC.map((componente) => {
      const score = Number(r[componente.score]);
      const peso = detalle.pesos?.[componente.score] ?? PESOS_POR_DEFECTO[componente.score];
      const filas: FilaEntrada[] = componente.entradas.map((e) => {
        const valor = detalle.entradas?.[e.clave];
        return {
          etiqueta: e.etiqueta,
          valor: valor === undefined ? 'Sin dato' : formatearIndicador(valor, e.unidad),
          penalizacion: detalle.penalizaciones?.[e.clave] ?? 0,
        };
      });
      if (componente.score === 'score_estabilidad') {
        filas.push({
          etiqueta: 'Indicadores negativos',
          valor: String(detalle.indicadores_negativos ?? 0),
          penalizacion: detalle.penalizaciones?.INDICADORES_NEGATIVOS ?? 0,
        });
      }
      return { ...componente, score, peso, aporte: score * peso, filas };
    });
  });

  protected readonly faltantes = computed(() =>
    (this.riesgo().detalle_calculo.indicadores_faltantes ?? []).map(
      (clave) => ETIQUETAS_ENTRADA[clave as EntradaIrpc] ?? clave,
    ),
  );
}
