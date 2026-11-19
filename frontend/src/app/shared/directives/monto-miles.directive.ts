import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const SEPARADOR_MILES = '.';
const SEPARADOR_DECIMAL = ',';
const MAX_DECIMALES = 2;
const MAX_DIGITOS_ENTEROS = 12;

/** Conserva dígitos y una sola coma decimal (con máximo 2 decimales). Acepta `.` como decimal al pegar "1234.5". */
function normalizar(texto: string): string {
  const sinMiles = /^\d+\.\d{1,2}$/.test(texto) ? texto.replace('.', SEPARADOR_DECIMAL) : texto;
  const [entero = '', ...resto] = sinMiles.replace(/[^\d,]/g, '').split(SEPARADOR_DECIMAL);
  const enteroLimpio = entero.replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITOS_ENTEROS);
  return resto.length
    ? `${enteroLimpio || '0'}${SEPARADOR_DECIMAL}${resto.join('').slice(0, MAX_DECIMALES)}`
    : enteroLimpio;
}

function agrupar(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARADOR_MILES);
}

function formatear(limpio: string): string {
  const [entero = '', decimales] = limpio.split(SEPARADOR_DECIMAL);
  return decimales === undefined ? agrupar(entero) : `${agrupar(entero)}${SEPARADOR_DECIMAL}${decimales}`;
}

function aNumero(limpio: string): number | null {
  if (!limpio) return null;
  const numero = Number(limpio.replace(SEPARADOR_DECIMAL, '.'));
  return Number.isFinite(numero) ? numero : null;
}

function desdeNumero(valor: number): string {
  const [entero = '0', decimales] = Math.abs(valor).toFixed(MAX_DECIMALES).split('.');
  const dec = decimales?.replace(/0+$/, '');
  return dec ? `${entero}${SEPARADOR_DECIMAL}${dec}` : entero;
}

/** Cantidad de caracteres significativos (dígitos o coma) a la izquierda de `posicion`. */
function significativos(texto: string, posicion: number): number {
  return texto.slice(0, posicion).replace(/[^\d,]/g, '').length;
}

/**
 * Campo numérico con separadores de miles en vivo (`1.250.000,50`, formato es-CO).
 * El control recibe un `number` (o `null`), de modo que `Validators.min/max` funcionan directamente.
 * Uso: `<input matInput appMontoMiles formControlName="monto_inversion_usd" />`
 */
@Directive({
  selector: 'input[appMontoMiles]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MontoMilesDirective), multi: true },
  ],
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    '(input)': 'alEscribir()',
    '(blur)': 'alSalir()',
  },
})
export class MontoMilesDirective implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private notificarCambio: (valor: number | null) => void = () => undefined;
  private notificarTocado: () => void = () => undefined;

  writeValue(valor: number | string | null | undefined): void {
    const numero = valor === null || valor === undefined || valor === '' ? null : Number(valor);
    this.input.value = numero === null || !Number.isFinite(numero) ? '' : formatear(desdeNumero(numero));
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.notificarCambio = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.notificarTocado = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.input.disabled = deshabilitado;
  }

  protected alEscribir(): void {
    const texto = this.input.value;
    const cursor = significativos(texto, this.input.selectionStart ?? texto.length);
    const limpio = normalizar(texto);
    const formateado = formatear(limpio);
    this.input.value = formateado;
    this.reubicarCursor(formateado, cursor);
    this.notificarCambio(aNumero(limpio));
  }

  protected alSalir(): void {
    // Elimina una coma final sin decimales ("1.000," → "1.000").
    this.input.value = this.input.value.replace(/,$/, '');
    this.notificarTocado();
  }

  /** Mantiene el cursor tras el mismo dígito aunque se hayan insertado/eliminado puntos. */
  private reubicarCursor(formateado: string, significativosAntes: number): void {
    if (document.activeElement !== this.input) return;
    let posicion = 0;
    let contados = 0;
    while (posicion < formateado.length && contados < significativosAntes) {
      if (/[\d,]/.test(formateado.charAt(posicion))) contados++;
      posicion++;
    }
    this.input.setSelectionRange(posicion, posicion);
  }
}
