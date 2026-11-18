import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Permite el acceso solo con sesión activa; si no, redirige al login conservando la URL destino. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.haySesion()) {
    return true;
  }
  auth.cerrarSesion();
  return inject(Router).createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

/** Para las vistas de login/registro: si ya hay sesión, envía al dashboard. */
export const invitadoGuard: CanActivateFn = () =>
  inject(AuthService).haySesion() ? inject(Router).createUrlTree(['/dashboard']) : true;
