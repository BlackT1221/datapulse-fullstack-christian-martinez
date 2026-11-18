import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import {
  REINTENTADA_TRAS_REFRESH,
  SOLICITUD_AUTENTICACION,
} from '../../interceptors/contexto-http';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../services/auth.service';

function conToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Adjunta `Authorization: Bearer <access>` a las solicitudes de nuestra API. Ante un 401 intenta
 * renovar el access token una sola vez y reintenta; si falla, propaga el 401 original para que el
 * `ErrorInterceptor` cierre la sesión y redirija al login.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const api = inject(ApiService);

  if (!api.esUrlPropia(req.url) || req.context.get(SOLICITUD_AUTENTICACION)) {
    return next(req);
  }

  const token = auth.accessToken;
  const solicitud = token ? conToken(req, token) : req;

  return next(solicitud).pipe(
    catchError((error: unknown) => {
      const puedeRefrescar =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.context.get(REINTENTADA_TRAS_REFRESH) &&
        auth.haySesion();
      if (!puedeRefrescar) {
        return throwError(() => error);
      }
      return auth.refrescarToken().pipe(
        catchError(() => throwError(() => error)),
        switchMap((nuevo) => {
          req.context.set(REINTENTADA_TRAS_REFRESH, true);
          return next(conToken(req, nuevo));
        }),
      );
    }),
  );
};
