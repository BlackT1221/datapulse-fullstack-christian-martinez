import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { provideCharts } from 'ng2-charts';

/**
 * Registra solo los elementos de Chart.js que usan los gráficos de línea. Se provee a nivel de ruta
 * lazy (dashboard, países) para que Chart.js no entre en el bundle inicial.
 */
export function proveerGraficos(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideCharts({
      registerables: [
        LineController,
        LineElement,
        PointElement,
        LinearScale,
        CategoryScale,
        Tooltip,
        Legend,
        Filler,
      ],
    }),
  ]);
}
