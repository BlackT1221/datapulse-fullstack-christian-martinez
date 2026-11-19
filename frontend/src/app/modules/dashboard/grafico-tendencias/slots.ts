/**
 * Asigna a cada código un slot de color estable: los que siguen seleccionados conservan su slot y
 * los nuevos toman el menor slot libre (el color sigue a la entidad, nunca a su posición).
 */
export function asignarSlots(
  previo: Readonly<Record<string, number>>,
  seleccion: readonly string[],
): Readonly<Record<string, number>> {
  const resultado: Record<string, number> = {};
  for (const codigo of seleccion) {
    if (previo[codigo] !== undefined) {
      resultado[codigo] = previo[codigo];
    }
  }
  const ocupados = new Set(Object.values(resultado));
  for (const codigo of seleccion) {
    if (resultado[codigo] === undefined) {
      let slot = 0;
      while (ocupados.has(slot)) slot++;
      resultado[codigo] = slot;
      ocupados.add(slot);
    }
  }
  return resultado;
}
