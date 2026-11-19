import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { ETIQUETAS_INDICADOR, IndicadorEconomico, TipoIndicador } from '../../../../core/models';
import { ValorIndicadorPipe } from '../../../../shared/pipes';
import { LOCALE } from '../../../../shared/pipes/numero';

interface TarjetaIndicador {
  tipo: TipoIndicador;
  etiqueta: string;
  icono: string;
  actual: IndicadorEconomico | null;
  /** Cambio vs. el año anterior: puntos porcentuales o % de variación según la unidad. */
  cambio: { valor: number; texto: string; anioAnterior: number } | null;
}

const ICONOS: Readonly<Record<TipoIndicador, string>> = {
  PIB: 'account_balance',
  PIB_PERCAPITA: 'person',
  INFLACION: 'local_fire_department',
  DESEMPLEO: 'work_off',
  BALANZA_COMERCIAL: 'swap_horiz',
  DEUDA_PIB: 'credit_card',
};

const ORDEN: readonly TipoIndicador[] = [
  'PIB',
  'PIB_PERCAPITA',
  'INFLACION',
  'DESEMPLEO',
  'BALANZA_COMERCIAL',
  'DEUDA_PIB',
];

const FORMATO_CAMBIO = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

function calcularCambio(actual: IndicadorEconomico, anterior: IndicadorEconomico | undefined) {
  if (!anterior) return null;
  const a = Number(actual.valor);
  const b = Number(anterior.valor);
  const esPuntos = actual.unidad === 'PORCENTAJE';
  if (!esPuntos && b === 0) return null;
  const valor = esPuntos ? a - b : ((a - b) / Math.abs(b)) * 100;
  const numero = FORMATO_CAMBIO.format(valor);
  return { valor, texto: esPuntos ? `${numero} pp` : `${numero} %`, anioAnterior: anterior.anio };
}

@Component({
  selector: 'app-indicadores-pais',
  imports: [MatCardModule, MatIconModule, ValorIndicadorPipe],
  templateUrl: './indicadores-pais.component.html',
  styleUrl: './indicadores-pais.component.scss',
})
export class IndicadoresPaisComponent {
  readonly indicadores = input.required<IndicadorEconomico[]>();

  protected readonly tarjetas = computed<TarjetaIndicador[]>(() => {
    const porTipo = new Map<TipoIndicador, IndicadorEconomico[]>();
    for (const indicador of this.indicadores()) {
      porTipo.set(indicador.tipo, [...(porTipo.get(indicador.tipo) ?? []), indicador]);
    }
    return ORDEN.map((tipo) => {
      const serie = [...(porTipo.get(tipo) ?? [])].sort((x, y) => y.anio - x.anio);
      const actual = serie[0] ?? null;
      return {
        tipo,
        etiqueta: ETIQUETAS_INDICADOR[tipo],
        icono: ICONOS[tipo],
        actual,
        cambio: actual ? calcularCambio(actual, serie[1]) : null,
      };
    });
  });
}
