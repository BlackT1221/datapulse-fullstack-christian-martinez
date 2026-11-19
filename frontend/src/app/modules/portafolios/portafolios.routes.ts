import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/guards/role.guard';
import { proveerGraficosDistribucion } from '../../shared/charts/charts.providers';
import { PaginadorEs } from '../../shared/intl/paginador-es';
import { ROLES_EDICION } from './permisos';

const cargarFormulario = () =>
  import('./crear/portafolio-form.component').then((m) => m.PortafolioFormComponent);

export const PORTAFOLIOS_ROUTES: Routes = [
  {
    path: '',
    providers: [
      proveerGraficosDistribucion(),
      provideNativeDateAdapter(),
      { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
      { provide: MatPaginatorIntl, useClass: PaginadorEs },
    ],
    children: [
      {
        path: '',
        title: 'Portafolios · DataPulse Latam',
        loadComponent: () => import('./lista/lista.component').then((m) => m.ListaComponent),
      },
      {
        path: 'crear',
        title: 'Nuevo portafolio · DataPulse Latam',
        canActivate: [roleGuard],
        data: { roles: ROLES_EDICION },
        loadComponent: cargarFormulario,
      },
      {
        path: ':id',
        title: 'Detalle de portafolio · DataPulse Latam',
        loadComponent: () => import('./detalle/detalle.component').then((m) => m.DetalleComponent),
      },
      {
        path: ':id/editar',
        title: 'Editar portafolio · DataPulse Latam',
        canActivate: [roleGuard],
        data: { roles: ROLES_EDICION },
        loadComponent: cargarFormulario,
      },
    ],
  },
];
