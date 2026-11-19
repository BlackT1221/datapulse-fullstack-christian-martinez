import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';

import { ErrorApi } from '../models';

const MENSAJE_SIN_CONEXION =
  'No se pudo conectar con el servidor. Verifica tu conexión a internet e inténtalo nuevamente.';

const MENSAJES_POR_ESTADO: Readonly<Record<number, string>> = {
  400: 'La solicitud contiene datos inválidos.',
  401: 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'El recurso fue modificado por otro usuario. Recarga la información e inténtalo de nuevo.',
  429: 'Has realizado demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
};

const MENSAJE_ERROR_SERVIDOR = 'Ocurrió un error en el servidor. Inténtalo más tarde.';
const MENSAJE_GENERICO = 'Ocurrió un error inesperado al procesar la solicitud.';
const CLAVES_NO_CAMPO = ['non_field_errors', 'detail'];

export function esErrorApi(valor: unknown): valor is ErrorApi {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'mensaje' in valor &&
    typeof valor.mensaje === 'string' &&
    'codigo' in valor &&
    typeof valor.codigo === 'number'
  );
}

export function esErrorDeRed(error: HttpErrorResponse): boolean {
  return error.status === 0;
}

function aLista(valor: unknown): string[] {
  if (typeof valor === 'string') {
    return [valor];
  }
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : [];
}

/** Errores de validación agrupados por campo (`non_field_errors` incluido). */
export function erroresPorCampo(error: HttpErrorResponse): Record<string, string[]> {
  const cuerpo: unknown = error.error;
  if (!esErrorApi(cuerpo) || cuerpo.detalles === null) {
    return {};
  }
  if (Array.isArray(cuerpo.detalles)) {
    return { non_field_errors: aLista(cuerpo.detalles) };
  }
  const resultado: Record<string, string[]> = {};
  for (const [campo, mensajes] of Object.entries(cuerpo.detalles)) {
    const lista = aLista(mensajes);
    if (lista.length) {
      resultado[campo] = lista;
    }
  }
  return resultado;
}

/** Mensaje legible en español para mostrar al usuario. */
export function extraerMensajeError(error: HttpErrorResponse): string {
  if (esErrorDeRed(error)) {
    return MENSAJE_SIN_CONEXION;
  }
  const cuerpo: unknown = error.error;
  if (esErrorApi(cuerpo)) {
    const primero = Object.values(erroresPorCampo(error))[0]?.[0];
    return error.status === 400 && primero ? `${cuerpo.mensaje} ${primero}` : cuerpo.mensaje;
  }
  if (error.status >= 500) {
    return MENSAJE_ERROR_SERVIDOR;
  }
  return MENSAJES_POR_ESTADO[error.status] ?? MENSAJE_GENERICO;
}

/**
 * Asigna los errores del backend a los controles del formulario como `{ servidor: mensaje }`.
 * Devuelve los mensajes que no corresponden a ningún control (errores generales).
 */
export function aplicarErroresServidor(form: FormGroup, error: HttpErrorResponse): string[] {
  const generales: string[] = [];
  for (const [campo, mensajes] of Object.entries(erroresPorCampo(error))) {
    const control: AbstractControl | null = CLAVES_NO_CAMPO.includes(campo)
      ? null
      : form.get(campo);
    if (control) {
      control.setErrors({ ...control.errors, servidor: mensajes.join(' ') });
      control.markAsTouched();
    } else {
      generales.push(...mensajes);
    }
  }
  return generales;
}
