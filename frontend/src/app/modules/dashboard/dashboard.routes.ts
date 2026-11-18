import { Routes } from '@angular/router';

import { proveerGraficos } from '../../shared/charts/charts.providers';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    providers: [proveerGraficos()],
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
];
