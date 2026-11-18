import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../auth/services/auth.service';
import { NotificacionService } from '../services/notificacion.service';
import { extraerMensajeError } from '../utils/errores-api';
import { OMITIR_NOTIFICACION_ERROR, SOLICITUD_AUTENTICACION } from './contexto-http';

const MENSAJE_SESION_EXPIRADA = 'Tu sesión ha expirado. Inicia sesión nuevamente para continuar.';

/**
 * Manejo global de errores HTTP:
 * - 401 (fuera de login/registro): cierra la sesión y redirige a `/auth/login` con un mensaje.
 * - Error de red (status 0) y demás errores: muestra un `MatSnackBar` con el mensaje del backend.
 * El error siempre se re-emite para que el llamador pueda reaccionar.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notificacion = inject(NotificacionService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401 && !req.context.get(SOLICITUD_AUTENTICACION)) {
        const habiaSesion = auth.cerrarSesion();
        const enLogin = router.url.startsWith('/auth');
        if (habiaSesion) {
          notificacion.advertencia(MENSAJE_SESION_EXPIRADA);
        }
        if (!enLogin) {
          void router.navigate(['/auth/login'], {
            queryParams: { returnUrl: router.url, sesion: 'expirada' },
          });
        }
      } else if (!req.context.get(OMITIR_NOTIFICACION_ERROR)) {
        notificacion.error(extraerMensajeError(error));
      }

      return throwError(() => error);
    }),
  );
};
