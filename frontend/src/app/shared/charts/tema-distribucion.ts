import { ChartOptions, TooltipItem } from 'chart.js';

import { FUENTE, TINTA } from './tema-graficos';

/**
 * Paleta categórica de 8 slots validada (banda de luminosidad, croma, separación CVD entre
 * adyacentes). Varios slots quedan < 3:1 sobre la superficie, por eso cada gráfico de
 * distribución se acompaña de una leyenda-tabla con nombre, monto y porcentaje.
 */
export const CATEGORICA = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const;

/** Segmento agregado "Otros" cuando hay más entidades que slots. */
export const COLOR_OTROS = '#9a9aa0';

export interface SegmentoDistribucion {
  clave: string;
  etiqueta: string;
  monto: number;
  porcentaje: number;
  color: string;
}

/** Opciones base Pie/Donut: 2px de separación de superficie entre porciones, tooltip con monto y %. */
export function opcionesDistribucion<T extends 'pie' | 'doughnut'>(
  tipo: T,
  segmentos: () => readonly SegmentoDistribucion[],
  formatoMonto: (valor: number) => string,
): ChartOptions<T> {
  const etiqueta = (item: TooltipItem<'pie' | 'doughnut'>): string => {
    const segmento = segmentos()[item.dataIndex];
    return segmento
      ? ` ${formatoMonto(segmento.monto)} · ${segmento.porcentaje.toLocaleString('es-CO')} %`
      : '';
  };
  const opciones: ChartOptions<'pie' | 'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    cutout: tipo === 'doughnut' ? '62%' : 0,
    elements: { arc: { borderWidth: 2, borderColor: TINTA.superficie, hoverOffset: 6 } },
    layout: { padding: 6 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: TINTA.superficie,
        titleColor: TINTA.primaria,
        bodyColor: TINTA.secundaria,
        borderColor: TINTA.rejilla,
        borderWidth: 1,
        padding: 10,
        titleFont: FUENTE,
        bodyFont: FUENTE,
        usePointStyle: true,
        callbacks: { label: etiqueta },
      },
    },
  };
  return opciones as ChartOptions<T>;
}
