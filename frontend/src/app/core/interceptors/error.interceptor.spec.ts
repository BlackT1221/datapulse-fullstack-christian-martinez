import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../auth/services/auth.service';
import { NotificacionService } from '../services/notificacion.service';
import { contextoAutenticacion } from './contexto-http';
import { errorInterceptor } from './error.interceptor';

/** Escenario obligatorio 2: ante un 401 se cierra la sesión y se redirige al login con aviso. */
describe('errorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let notificacion: jasmine.SpyObj<NotificacionService>;
  let router: Router;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['cerrarSesion']);
    notificacion = jasmine.createSpyObj<NotificacionService>('NotificacionService', [
      'advertencia',
      'error',
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => backend.verify());

  it('401 con sesión activa: cierra sesión, avisa y redirige a /auth/login', () => {
    auth.cerrarSesion.and.returnValue(true);
    let status = 0;
    http.get('/api/portafolios/').subscribe({ error: (e: { status: number }) => (status = e.status) });
    backend.expectOne('/api/portafolios/').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.cerrarSesion).toHaveBeenCalled();
    expect(notificacion.advertencia).toHaveBeenCalledWith(
      'Tu sesión ha expirado. Inicia sesión nuevamente para continuar.',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/', sesion: 'expirada' },
    });
  });

  it('401 en el propio login no cierra sesión (credenciales inválidas)', () => {
    http.post('/api/auth/login/', {}, { context: contextoAutenticacion() }).subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/login/').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.cerrarSesion).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('403 muestra el mensaje del backend en español', () => {
    http.post('/api/portafolios/', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/portafolios/').flush(
      { error: true, codigo: 403, mensaje: 'No tienes permisos para realizar esta acción.', detalles: null },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(notificacion.error).toHaveBeenCalledWith('No tienes permisos para realizar esta acción.');
  });

  it('error de red (status 0) muestra mensaje de conexión', () => {
    http.get('/api/paises/').subscribe({ error: () => undefined });
    backend.expectOne('/api/paises/').error(new ProgressEvent('error'), { status: 0 });
    expect(notificacion.error).toHaveBeenCalledWith(jasmine.stringContaining('No se pudo conectar'));
  });
});
