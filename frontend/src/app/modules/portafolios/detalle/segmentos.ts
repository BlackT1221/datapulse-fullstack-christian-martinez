import { MetricasPortafolio, Posicion, TipoActivo } from '../../../core/models';
import { CATEGORICA, COLOR_OTROS, SegmentoDistribucion } from '../../../shared/charts/tema-distribucion';

const ORDEN_TIPO: readonly TipoActivo[] = ['RENTA_FIJA', 'RENTA_VARIABLE', 'COMMODITIES', 'MONEDA'];

/**
 * Por país: el color sigue a la entidad, no a su ranking. Cada país del portafolio (incluidas
 * posiciones cerradas) recibe un slot fijo por orden alfabético de ISO, de modo que cerrar o
 * agregar una posición no repinta a los demás. Si hay más países que slots, los menores se
 * agrupan en "Otros".
 */
export function segmentosPorPais(
  metricas: MetricasPortafolio,
  posiciones: readonly Posicion[],
): SegmentoDistribucion[] {
  const orden = [...new Set(posiciones.map((p) => p.pais))].sort();
  const filas = metricas.distribucion_pais;
  const visibles = filas.length > CATEGORICA.length ? filas.slice(0, CATEGORICA.length - 1) : filas;
  const segmentos: SegmentoDistribucion[] = visibles.map((d) => ({
    clave: d.pais,
    etiqueta: d.nombre,
    monto: d.monto,
    porcentaje: d.porcentaje,
    color: CATEGORICA[orden.indexOf(d.pais) % CATEGORICA.length] ?? COLOR_OTROS,
  }));
  const resto = filas.slice(visibles.length);
  if (resto.length) {
    segmentos.push({
      clave: 'OTROS',
      etiqueta: `Otros (${resto.length})`,
      monto: resto.reduce((s, d) => s + d.monto, 0),
      porcentaje: resto.reduce((s, d) => s + d.porcentaje, 0),
      color: COLOR_OTROS,
    });
  }
  return segmentos;
}

/** Por tipo de activo: slot fijo por tipo (4 tipos ≤ slots validados). */
export function segmentosPorTipo(metricas: MetricasPortafolio): SegmentoDistribucion[] {
  return metricas.distribucion_tipo_activo.map((d) => ({
    clave: d.tipo_activo,
    etiqueta: d.etiqueta,
    monto: d.monto,
    porcentaje: d.porcentaje,
    color: CATEGORICA[ORDEN_TIPO.indexOf(d.tipo_activo)] ?? COLOR_OTROS,
  }));
}
