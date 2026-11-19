import { Routes } from '@angular/router';

import { authGuard, invitadoGuard } from './core/auth/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'auth',
    canActivate: [invitadoGuard],
    loadChildren: () => import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · DataPulse Latam',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'paises',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/paises/paises.routes').then((m) => m.PAISES_ROUTES),
  },
  {
    path: 'portafolios',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./modules/portafolios/portafolios.routes').then((m) => m.PORTAFOLIOS_ROUTES),
  },
  {
    path: 'alertas',
    canActivate: [authGuard],
    loadChildren: () => import('./modules/alertas/alertas.routes').then((m) => m.ALERTAS_ROUTES),
  },
  {
    path: '**',
    title: 'Página no encontrada · DataPulse Latam',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
