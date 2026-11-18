import { HttpContext, HttpContextToken } from '@angular/common/http';

/** No muestra el indicador global de carga (p. ej. polling en segundo plano). */
export const OMITIR_LOADING = new HttpContextToken<boolean>(() => false);

/** No muestra snackbar de error: el componente que hizo la solicitud gestiona el mensaje. */
export const OMITIR_NOTIFICACION_ERROR = new HttpContextToken<boolean>(() => false);

/**
 * Solicitud pública de autenticación (login, registro, refresh): no adjunta el JWT, no intenta
 * renovar el token y un 401 no se trata como sesión expirada.
 */
export const SOLICITUD_AUTENTICACION = new HttpContextToken<boolean>(() => false);

/** Marca interna: la solicitud ya se reintentó tras renovar el access token. */
export const REINTENTADA_TRAS_REFRESH = new HttpContextToken<boolean>(() => false);

export function contextoSilencioso(): HttpContext {
  return new HttpContext().set(OMITIR_LOADING, true).set(OMITIR_NOTIFICACION_ERROR, true);
}

export function contextoAutenticacion(): HttpContext {
  return new HttpContext().set(SOLICITUD_AUTENTICACION, true).set(OMITIR_NOTIFICACION_ERROR, true);
}
