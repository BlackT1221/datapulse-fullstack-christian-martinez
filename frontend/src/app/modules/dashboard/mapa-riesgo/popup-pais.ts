import { NIVELES_RIESGO, PaisMapa } from '../../../core/models';

function elemento<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  nodo.className = clase;
  if (texto !== undefined) {
    nodo.textContent = texto;
  }
  return nodo;
}

const FORMATO_IRPC = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/**
 * Contenido del popup del mapa construido con nodos DOM (`textContent`), nunca con `innerHTML`,
 * para no interpretar datos externos como HTML.
 */
export function crearPopupPais(pais: PaisMapa, alVerDetalle: (iso: string) => void): HTMLElement {
  const raiz = elemento('div', 'popup-pais');

  const cabecera = elemento('div', 'popup-pais__cabecera');
  if (pais.bandera_url) {
    const bandera = elemento('img', 'popup-pais__bandera');
    bandera.src = pais.bandera_url;
    bandera.alt = `Bandera de ${pais.nombre}`;
    cabecera.append(bandera);
  }
  cabecera.append(elemento('strong', 'popup-pais__nombre', pais.nombre));
  raiz.append(cabecera);

  if (pais.irpc !== null && pais.nivel_riesgo) {
    const nivel = NIVELES_RIESGO[pais.nivel_riesgo];
    const fila = elemento('div', 'popup-pais__irpc');
    fila.append(elemento('span', 'popup-pais__valor', FORMATO_IRPC.format(pais.irpc)));
    const chip = elemento('span', 'popup-pais__nivel');
    const punto = elemento('span', 'popup-pais__punto');
    punto.style.backgroundColor = nivel.color;
    chip.append(punto, document.createTextNode(`Riesgo ${nivel.etiqueta.toLowerCase()}`));
    fila.append(chip);
    raiz.append(fila, elemento('p', 'popup-pais__accion', pais.accion_recomendada ?? nivel.accion));
  } else {
    raiz.append(elemento('p', 'popup-pais__accion', 'IRPC aún no calculado.'));
  }

  if (pais.alertas_no_leidas > 0) {
    const plural = pais.alertas_no_leidas === 1 ? 'alerta sin leer' : 'alertas sin leer';
    raiz.append(elemento('p', 'popup-pais__alertas', `${pais.alertas_no_leidas} ${plural}`));
  }

  const boton = elemento('button', 'popup-pais__boton', 'Ver detalle del país');
  boton.type = 'button';
  boton.addEventListener('click', () => alVerDetalle(pais.codigo_iso));
  raiz.append(boton);
  return raiz;
}
