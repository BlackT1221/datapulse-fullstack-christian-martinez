import { EntradaIrpc, ScoreIrpc } from '../../../../core/models';

export interface EntradaComponente {
  clave: EntradaIrpc;
  etiqueta: string;
  unidad: 'USD' | 'PORCENTAJE';
}

export interface ComponenteIrpc {
  score: ScoreIrpc;
  titulo: string;
  descripcion: string;
  entradas: readonly EntradaComponente[];
}

/** Espejo de `apps.risk.irpc.COMPONENTES` con etiquetas para la UI (SPEC §4.2). */
export const COMPONENTES_IRPC: readonly ComponenteIrpc[] = [
  {
    score: 'score_economico',
    titulo: 'Económico',
    descripcion: 'PIB per cápita, inflación, desempleo y deuda',
    entradas: [
      { clave: 'PIB_PERCAPITA', etiqueta: 'PIB per cápita', unidad: 'USD' },
      { clave: 'INFLACION', etiqueta: 'Inflación', unidad: 'PORCENTAJE' },
      { clave: 'DESEMPLEO', etiqueta: 'Desempleo', unidad: 'PORCENTAJE' },
      { clave: 'DEUDA_PIB', etiqueta: 'Deuda / PIB', unidad: 'PORCENTAJE' },
    ],
  },
  {
    score: 'score_cambiario',
    titulo: 'Cambiario',
    descripcion: 'Volatilidad y depreciación a 30 días',
    entradas: [
      { clave: 'VOLATILIDAD', etiqueta: 'Volatilidad diaria', unidad: 'PORCENTAJE' },
      { clave: 'DEPRECIACION', etiqueta: 'Depreciación 30 d', unidad: 'PORCENTAJE' },
    ],
  },
  {
    score: 'score_estabilidad',
    titulo: 'Estabilidad',
    descripcion: 'Balanza comercial, crecimiento del PIB y concentración de negativos',
    entradas: [
      { clave: 'BALANZA_COMERCIAL', etiqueta: 'Balanza comercial', unidad: 'PORCENTAJE' },
      { clave: 'CRECIMIENTO_PIB', etiqueta: 'Crecimiento del PIB', unidad: 'PORCENTAJE' },
    ],
  },
];

export const PESOS_POR_DEFECTO: Readonly<Record<ScoreIrpc, number>> = {
  score_economico: 0.4,
  score_cambiario: 0.3,
  score_estabilidad: 0.3,
};

export const ETIQUETAS_ENTRADA: Readonly<Record<EntradaIrpc, string>> = Object.fromEntries(
  COMPONENTES_IRPC.flatMap((c) => c.entradas.map((e) => [e.clave, e.etiqueta])),
) as Record<EntradaIrpc, string>;
