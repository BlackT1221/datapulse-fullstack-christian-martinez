import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { Rol } from '../../models';
import { NotificacionService } from '../../services/notificacion.service';
import { AuthService } from '../services/auth.service';
import { authGuard, invitadoGuard } from './auth.guard';
import { roleGuard } from './role.guard';

describe('Guards de autenticación', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let notificacion: jasmine.SpyObj<NotificacionService>;
  let router: Router;

  const estado = (url: string) => ({ url }) as RouterStateSnapshot;
  const ruta = (data: Record<string, unknown> = {}) => ({ data }) as unknown as ActivatedRouteSnapshot;
  const serializar = (resultado: unknown) =>
    resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['haySesion', 'cerrarSesion', 'tieneRol']);
    notificacion = jasmine.createSpyObj<NotificacionService>('NotificacionService', ['advertencia']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    const ejecutar = (url: string) =>
      TestBed.runInInjectionContext(() => authGuard(ruta(), estado(url)));

    it('permite el acceso con sesión activa', () => {
      auth.haySesion.and.returnValue(true);
      expect(ejecutar('/portafolios')).toBeTrue();
      expect(auth.cerrarSesion).not.toHaveBeenCalled();
    });

    it('sin sesión limpia el estado y redirige al login conservando la URL destino', () => {
      auth.haySesion.and.returnValue(false);
      const resultado = ejecutar('/portafolios/7');
      expect(auth.cerrarSesion).toHaveBeenCalled();
      expect(serializar(resultado)).toBe('/auth/login?returnUrl=%2Fportafolios%2F7');
    });
  });

  describe('invitadoGuard', () => {
    const ejecutar = () => TestBed.runInInjectionContext(() => invitadoGuard(ruta(), estado('/auth/login')));

    it('envía al dashboard si ya hay sesión', () => {
      auth.haySesion.and.returnValue(true);
      expect(serializar(ejecutar())).toBe('/dashboard');
    });

    it('permite ver login/registro sin sesión', () => {
      auth.haySesion.and.returnValue(false);
      expect(ejecutar()).toBeTrue();
    });
  });

  describe('roleGuard', () => {
    const ejecutar = (roles?: unknown) =>
      TestBed.runInInjectionContext(() =>
        roleGuard(ruta(roles === undefined ? {} : { roles }), estado('/portafolios/crear')),
      );

    it('permite rutas sin roles declarados', () => {
      expect(ejecutar()).toBeTrue();
      expect(auth.tieneRol).not.toHaveBeenCalled();
    });

    it('permite el acceso cuando el usuario tiene uno de los roles', () => {
      auth.tieneRol.and.returnValue(true);
      expect(ejecutar(['ADMIN', 'ANALISTA'])).toBeTrue();
      expect(auth.tieneRol).toHaveBeenCalledWith('ADMIN', 'ANALISTA');
    });

    it('un VIEWER es redirigido al dashboard con un aviso', () => {
      auth.tieneRol.and.callFake((...roles: Rol[]) => roles.includes('VIEWER'));
      const resultado = ejecutar(['ADMIN', 'ANALISTA']);
      expect(serializar(resultado)).toBe('/dashboard');
      expect(notificacion.advertencia).toHaveBeenCalledWith(
        'No tienes permisos para acceder a esta sección.',
      );
    });

    it('descarta valores de rol inválidos en data.roles', () => {
      auth.tieneRol.and.returnValue(false);
      ejecutar(['ADMIN', 'SUPERUSUARIO', 42]);
      expect(auth.tieneRol).toHaveBeenCalledWith('ADMIN');
    });
  });
});
