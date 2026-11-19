import { Chart, ChartOptions, LegendItem, Plugin, TooltipItem } from 'chart.js';

import { SIN_DATO } from '../pipes/numero';

/**
 * Paleta categórica validada (orden fijo, nunca cíclico): azul, naranja, aqua. Los tres primeros
 * slots pasan separación CVD en todos los pares; el aqua queda < 3:1 sobre la superficie, por lo
 * que todo gráfico multiserie incluye leyenda y vista de tabla.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const;

export const TINTA = {
  primaria: '#1b1b1f',
  secundaria: '#44474e',
  rejilla: '#e3e2e6',
  crosshair: '#9a9aa0',
  superficie: '#ffffff',
} as const;

export const FUENTE = { family: 'Roboto, sans-serif', size: 12 } as const;

/** Línea vertical que sigue al tooltip activo (modo `index`). */
export const pluginCrosshair: Plugin<'line'> = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const activo = chart.tooltip?.getActiveElements()[0];
    if (!activo) {
      return;
    }
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(activo.element.x, chartArea.top);
    ctx.lineTo(activo.element.x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = TINTA.crosshair;
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * La clave `line` de la leyenda usa por defecto el borde del punto (anillo de superficie, blanco):
 * se reemplaza por el color de la serie para que la clave sea visible.
 */
function clavesDeLinea(chart: Chart<'line'>): LegendItem[] {
  return Chart.defaults.plugins.legend.labels
    .generateLabels(chart)
    .map((item) => ({ ...item, strokeStyle: item.fillStyle, lineWidth: 2 }));
}

export interface OpcionesGraficoLinea {
  formatoY: (valor: number) => string;
  leyenda: boolean;
  /** Radio de los marcadores en reposo (0 para series densas, p. ej. 30 días). */
  radioPunto?: number;
  maxTicksX?: number;
}

/** Opciones base para gráficos de línea: 2px, una sola escala Y, rejilla recesiva, tooltip índice. */
export function opcionesLinea(config: OpcionesGraficoLinea): ChartOptions<'line'> {
  const etiqueta = (item: TooltipItem<'line'>): string => {
    const valor = item.parsed.y === null ? SIN_DATO : config.formatoY(item.parsed.y);
    return config.leyenda ? `${valor}  ${item.dataset.label ?? ''}` : valor;
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    elements: {
      line: { borderWidth: 2, tension: 0.25, borderCapStyle: 'round', borderJoinStyle: 'round' },
      point: {
        radius: config.radioPunto ?? 4,
        hoverRadius: 6,
        hitRadius: 12,
        borderWidth: 2,
        borderColor: TINTA.superficie,
      },
    },
    plugins: {
      legend: {
        display: config.leyenda,
        position: 'top',
        align: 'start',
        labels: {
          usePointStyle: true,
          pointStyle: 'line',
          pointStyleWidth: 18,
          color: TINTA.secundaria,
          font: FUENTE,
          generateLabels: clavesDeLinea,
        },
      },
      tooltip: {
        backgroundColor: TINTA.superficie,
        titleColor: TINTA.primaria,
        bodyColor: TINTA.secundaria,
        borderColor: TINTA.rejilla,
        borderWidth: 1,
        padding: 10,
        usePointStyle: true,
        callbacks: { label: etiqueta },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: TINTA.rejilla },
        ticks: { color: TINTA.secundaria, font: FUENTE, maxTicksLimit: config.maxTicksX ?? 12 },
      },
      y: {
        grid: { color: TINTA.rejilla },
        border: { display: false },
        ticks: {
          color: TINTA.secundaria,
          font: FUENTE,
          callback: (v) => config.formatoY(Number(v)),
        },
      },
    },
  };
}

/** Dataset de línea con la identidad de color de la serie y anillo de superficie en los puntos. */
export function datasetLinea(label: string, data: (number | null)[], color: string) {
  return {
    label,
    data,
    borderColor: color,
    borderWidth: 2,
    backgroundColor: color,
    pointBackgroundColor: color,
    pointBorderColor: TINTA.superficie,
    spanGaps: true,
  };
}
