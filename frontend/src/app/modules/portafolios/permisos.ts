import { Portafolio, Rol, Usuario } from '../../core/models';

/** Roles que pueden crear portafolios (el backend responde 403 a `VIEWER`). */
export const ROLES_EDICION: readonly Rol[] = ['ADMIN', 'ANALISTA'];

/**
 * Espejo de `PuedeEditarPortafolios` + `EsPropietarioOPublico` del backend: solo el propietario
 * (o un ADMIN) con rol distinto de VIEWER puede editar, eliminar o gestionar posiciones.
 */
export function puedeEditar(usuario: Usuario | null, portafolio: Portafolio): boolean {
  if (!usuario || !ROLES_EDICION.includes(usuario.rol)) return false;
  return portafolio.es_propio || usuario.rol === 'ADMIN';
}
