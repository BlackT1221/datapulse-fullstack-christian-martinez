import { MatPaginatorIntl } from '@angular/material/paginator';
import { Routes } from '@angular/router';

import { PaginadorEs } from '../../shared/intl/paginador-es';

export const ALERTAS_ROUTES: Routes = [
  {
    path: '',
    title: 'Alertas · DataPulse Latam',
    providers: [{ provide: MatPaginatorIntl, useClass: PaginadorEs }],
    loadComponent: () =>
      import('./panel-alertas/panel-alertas.component').then((m) => m.PanelAlertasComponent),
  },
];
