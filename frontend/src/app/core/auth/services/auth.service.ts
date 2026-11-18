import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  distinctUntilChanged,
  finalize,
  map,
  Observable,
  shareReplay,
  tap,
} from 'rxjs';

import { contextoAutenticacion } from '../../interceptors/contexto-http';
import {
  ActualizacionPerfil,
  CredencialesLogin,
  RespuestaAutenticacion,
  RespuestaRefresh,
  Rol,
  SolicitudRegistro,
  Usuario,
} from '../../models';
import { ApiService } from '../../services/api.service';
import { tokenExpirado } from '../utils/jwt';
import { TokenStorageService } from './token-storage.service';

/** Estado de sesión (JWT + usuario) persistido en `localStorage` y expuesto vía `BehaviorSubject`. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(TokenStorageService);
  private readonly router = inject(Router);

  private readonly usuarioSubject = new BehaviorSubject<Usuario | null>(this.sesionInicial());
  private refrescoEnCurso$: Observable<string> | null = null;

  readonly usuario$: Observable<Usuario | null> = this.usuarioSubject.asObservable();
  readonly autenticado$: Observable<boolean> = this.usuario$.pipe(
    map((usuario) => usuario !== null),
    distinctUntilChanged(),
  );

  get usuarioActual(): Usuario | null {
    return this.usuarioSubject.value;
  }

  get accessToken(): string | null {
    return this.storage.access;
  }

  /** Hay sesión utilizable si existe usuario y el refresh token sigue vigente. */
  haySesion(): boolean {
    return this.usuarioActual !== null && !tokenExpirado(this.storage.refresh, 0);
  }

  tieneRol(...roles: Rol[]): boolean {
    const usuario = this.usuarioActual;
    return usuario !== null && roles.includes(usuario.rol);
  }

  login(credenciales: CredencialesLogin): Observable<Usuario> {
    return this.api
      .post<RespuestaAutenticacion>('auth/login/', credenciales, {
        contexto: contextoAutenticacion(),
      })
      .pipe(map((respuesta) => this.iniciarSesion(respuesta)));
  }

  registrar(datos: SolicitudRegistro): Observable<Usuario> {
    return this.api
      .post<RespuestaAutenticacion>('auth/register/', datos, { contexto: contextoAutenticacion() })
      .pipe(map((respuesta) => this.iniciarSesion(respuesta)));
  }

  obtenerPerfil(): Observable<Usuario> {
    return this.api
      .get<Usuario>('auth/me/')
      .pipe(tap((usuario) => this.actualizarUsuario(usuario)));
  }

  actualizarPerfil(datos: ActualizacionPerfil): Observable<Usuario> {
    return this.api
      .put<Usuario>('auth/me/', datos)
      .pipe(tap((usuario) => this.actualizarUsuario(usuario)));
  }

  /**
   * Renueva el access token. Las llamadas concurrentes comparten una única solicitud al backend.
   * No cierra la sesión si falla: lo decide el `ErrorInterceptor` al recibir el 401 original.
   */
  refrescarToken(): Observable<string> {
    if (!this.refrescoEnCurso$) {
      const refresh = this.storage.refresh ?? '';
      this.refrescoEnCurso$ = this.api
        .post<RespuestaRefresh>('auth/refresh/', { refresh }, { contexto: contextoAutenticacion() })
        .pipe(
          tap((tokens) => this.storage.guardarTokens(tokens)),
          map((tokens) => tokens.access),
          finalize(() => (this.refrescoEnCurso$ = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refrescoEnCurso$;
  }

  /** Limpia la sesión local. Devuelve `true` si había una sesión activa. */
  cerrarSesion(): boolean {
    const habiaSesion = this.usuarioActual !== null || this.storage.access !== null;
    this.storage.limpiar();
    this.refrescoEnCurso$ = null;
    if (this.usuarioActual !== null) {
      this.usuarioSubject.next(null);
    }
    return habiaSesion;
  }

  /** Cierre de sesión iniciado por el usuario. */
  logout(): void {
    this.cerrarSesion();
    void this.router.navigate(['/auth/login']);
  }

  private iniciarSesion(respuesta: RespuestaAutenticacion): Usuario {
    this.storage.guardarTokens(respuesta);
    this.actualizarUsuario(respuesta.usuario);
    return respuesta.usuario;
  }

  private actualizarUsuario(usuario: Usuario): void {
    this.storage.guardarUsuario(usuario);
    this.usuarioSubject.next(usuario);
  }

  /** Restaura la sesión guardada solo si el refresh token aún es válido. */
  private sesionInicial(): Usuario | null {
    const usuario = this.storage.leerUsuario();
    if (usuario && !tokenExpirado(this.storage.refresh, 0)) {
      return usuario;
    }
    this.storage.limpiar();
    return null;
  }
}
