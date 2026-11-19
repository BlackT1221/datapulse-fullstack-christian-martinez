import { inject } from '@angular/core';
import { CanActivateFn, Data, Router } from '@angular/router';

import { esRol, Rol } from '../../models';
import { NotificacionService } from '../../services/notificacion.service';
import { AuthService } from '../services/auth.service';

/** Lee `data.roles` de la ruta descartando valores que no sean roles válidos. */
export function rolesDeRuta(data: Data): Rol[] {
  const roles: unknown = data['roles'];
  return Array.isArray(roles) ? roles.filter(esRol) : [];
}

/**
 * Restringe la ruta a los roles declarados en `data: { roles: [...] }`.
 * Úsalo junto a `authGuard`: `canActivate: [authGuard, roleGuard]`.
 */
export const roleGuard: CanActivateFn = (route) => {
  const roles = rolesDeRuta(route.data);
  const auth = inject(AuthService);
  if (roles.length === 0 || auth.tieneRol(...roles)) {
    return true;
  }
  inject(NotificacionService).advertencia('No tienes permisos para acceder a esta sección.');
  return inject(Router).createUrlTree(['/dashboard']);
};
