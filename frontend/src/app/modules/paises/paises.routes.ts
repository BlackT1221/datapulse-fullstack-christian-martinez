import { MatPaginatorIntl } from '@angular/material/paginator';
import { Routes } from '@angular/router';

import { proveerGraficos } from '../../shared/charts/charts.providers';
import { PaginadorEs } from '../../shared/intl/paginador-es';

export const PAISES_ROUTES: Routes = [
  {
    path: '',
    providers: [proveerGraficos(), { provide: MatPaginatorIntl, useClass: PaginadorEs }],
    children: [
      {
        path: '',
        title: 'Países · DataPulse Latam',
        loadComponent: () =>
          import('./lista-paises/lista-paises.component').then((m) => m.ListaPaisesComponent),
      },
      {
        path: ':codigoIso',
        title: 'Detalle de país · DataPulse Latam',
        loadComponent: () =>
          import('./detalle-pais/detalle-pais.component').then((m) => m.DetallePaisComponent),
      },
    ],
  },
];
