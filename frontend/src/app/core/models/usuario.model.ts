import { FechaHoraIso } from './api.model';

export const ROLES = ['ADMIN', 'ANALISTA', 'VIEWER'] as const;
export type Rol = (typeof ROLES)[number];
export type RolAutoregistro = Exclude<Rol, 'ADMIN'>;

export interface Usuario {
  id: number;
  email: string;
  nombre_completo: string;
  rol: Rol;
  activo: boolean;
  fecha_creacion: FechaHoraIso;
}

export interface Tokens {
  access: string;
  refresh: string;
}

export interface CredencialesLogin {
  email: string;
  password: string;
}

export interface RespuestaAutenticacion extends Tokens {
  usuario: Usuario;
}

export interface SolicitudRegistro {
  email: string;
  nombre_completo: string;
  rol: RolAutoregistro;
  password: string;
  password_confirmacion: string;
}

export interface RespuestaRefresh {
  access: string;
  refresh?: string;
}

export interface ActualizacionPerfil {
  nombre_completo: string;
}

/** Claims relevantes del access token emitido por SimpleJWT. */
export interface PayloadJwt {
  token_type: 'access' | 'refresh';
  exp: number;
  iat: number;
  jti: string;
  user_id: number | string;
}

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}
