import {
  clasificarIrpc,
  DistribucionPais,
  DistribucionTipoActivo,
  ETIQUETAS_TIPO_ACTIVO,
  MetricasPortafolio,
  MONTO_MAXIMO_ACTIVO_PORTAFOLIO,
  NIVELES_RIESGO,
  Pais,
  TipoActivo,
} from '../models';

/** Mínimo necesario de una posición para calcular métricas (sirve también para borradores). */
export interface PosicionCalculable {
  id?: number;
  pais: string;
  tipo_activo: TipoActivo;
  monto_inversion_usd: number | string;
  fecha_salida: string | null;
}

/** IRPC y nombre por país, construido a partir del catálogo de países. */
export interface InfoPaisRiesgo {
  nombre: string;
  irpc: number | null;
}

export type CatalogoRiesgo = ReadonlyMap<string, InfoPaisRiesgo>;

export function catalogoRiesgo(paises: readonly Pais[]): CatalogoRiesgo {
  return new Map(
    paises.map((p) => [
      p.codigo_iso,
      { nombre: p.nombre, irpc: p.irpc === null ? null : Number(p.irpc) },
    ]),
  );
}

const redondear = (valor: number): number => Math.round(valor * 100) / 100;
const porcentaje = (parte: number, total: number): number =>
  total ? redondear((parte / total) * 100) : 0;

export function esActiva(posicion: Pick<PosicionCalculable, 'fecha_salida'>): boolean {
  return posicion.fecha_salida === null;
}

export function montoActivo(posiciones: readonly PosicionCalculable[], excluirId?: number): number {
  return posiciones
    .filter((p) => esActiva(p) && (excluirId === undefined || p.id !== excluirId))
    .reduce((suma, p) => suma + Number(p.monto_inversion_usd), 0);
}

function acumular<K extends string>(
  posiciones: readonly PosicionCalculable[],
  clave: (p: PosicionCalculable) => K,
): Map<K, number> {
  const montos = new Map<K, number>();
  for (const p of posiciones) {
    montos.set(clave(p), (montos.get(clave(p)) ?? 0) + Number(p.monto_inversion_usd));
  }
  return montos;
}

/**
 * Métricas en tiempo real sobre las posiciones activas, equivalentes a
 * `apps.portfolios.services.calcular_metricas`. El riesgo promedio ponderado es
 * Σ(monto × IRPC) / Σ(monto) considerando solo los países con IRPC calculado.
 */
export function calcularMetricas(
  posiciones: readonly PosicionCalculable[],
  catalogo: CatalogoRiesgo,
): MetricasPortafolio {
  const activas = posiciones.filter(esActiva);
  const total = montoActivo(activas);

  let sumaPonderada = 0;
  let montoConIrpc = 0;
  for (const p of activas) {
    const irpc = catalogo.get(p.pais)?.irpc;
    if (irpc !== null && irpc !== undefined) {
      sumaPonderada += Number(p.monto_inversion_usd) * irpc;
      montoConIrpc += Number(p.monto_inversion_usd);
    }
  }
  const riesgo = montoConIrpc ? redondear(sumaPonderada / montoConIrpc) : null;
  const nivel = riesgo === null ? null : clasificarIrpc(riesgo);

  const distribucionPais: DistribucionPais[] = [...acumular(activas, (p) => p.pais)].map(
    ([iso, monto]) => {
      const irpc = catalogo.get(iso)?.irpc ?? null;
      const nivelPais = irpc === null ? null : clasificarIrpc(irpc);
      return {
        pais: iso,
        nombre: catalogo.get(iso)?.nombre ?? iso,
        irpc,
        nivel_riesgo: nivelPais,
        color: nivelPais ? NIVELES_RIESGO[nivelPais].color : null,
        monto: redondear(monto),
        porcentaje: porcentaje(monto, total),
      };
    },
  );

  const distribucionTipo: DistribucionTipoActivo[] = [
    ...acumular(activas, (p) => p.tipo_activo),
  ].map(([tipo, monto]) => ({
    tipo_activo: tipo,
    etiqueta: ETIQUETAS_TIPO_ACTIVO[tipo],
    monto: redondear(monto),
    porcentaje: porcentaje(monto, total),
  }));

  const porMonto = (a: { monto: number }, b: { monto: number }): number => b.monto - a.monto;

  return {
    monto_total_activo: redondear(total),
    monto_total_historico: redondear(
      posiciones.reduce((suma, p) => suma + Number(p.monto_inversion_usd), 0),
    ),
    limite_monto_activo: MONTO_MAXIMO_ACTIVO_PORTAFOLIO,
    monto_disponible: redondear(MONTO_MAXIMO_ACTIVO_PORTAFOLIO - total),
    posiciones_activas: activas.length,
    posiciones_cerradas: posiciones.length - activas.length,
    riesgo_promedio_ponderado: riesgo,
    nivel_riesgo: nivel,
    color_riesgo: nivel ? NIVELES_RIESGO[nivel].color : null,
    accion_recomendada: nivel ? NIVELES_RIESGO[nivel].accion : null,
    distribucion_pais: distribucionPais.sort(porMonto),
    distribucion_tipo_activo: distribucionTipo.sort(porMonto),
  };
}
