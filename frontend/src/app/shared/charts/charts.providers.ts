import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  ArcElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
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

/** Pie y Donut (distribución de portafolios); provisto solo en la ruta lazy de portafolios. */
export function proveerGraficosDistribucion(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideCharts({
      registerables: [PieController, DoughnutController, ArcElement, Tooltip, Legend],
    }),
  ]);
}
