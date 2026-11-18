import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth/interceptors/jwt.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Orden de solicitud: loading → error → jwt → backend (la respuesta recorre el orden inverso:
    // jwt renueva el token y reintenta antes de que error decida cerrar la sesión ante un 401).
    provideHttpClient(
      withFetch(),
      withInterceptors([loadingInterceptor, errorInterceptor, jwtInterceptor]),
    ),
  ],
};
