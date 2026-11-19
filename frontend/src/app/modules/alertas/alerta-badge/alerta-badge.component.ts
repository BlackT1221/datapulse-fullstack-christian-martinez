import { AsyncPipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, interval, startWith, Subscription, switchMap } from 'rxjs';

import { AlertaService, INTERVALO_POLLING_MS } from '../../../core/services/alerta.service';

/**
 * Campana del navbar con el conteo de alertas no leídas. Consulta `/alertas/resumen/` cada 30 s
 * (sin spinner ni snackbar); `switchMap` descarta una consulta lenta si llega el siguiente tick.
 * El polling vive mientras el componente exista (solo se renderiza con sesión iniciada).
 */
@Component({
  selector: 'app-alerta-badge',
  imports: [AsyncPipe, RouterLink, MatBadgeModule, MatButtonModule, MatIconModule],
  template: `
    @let conteo = (noLeidas$ | async) ?? 0;
    <a
      mat-icon-button
      routerLink="/alertas"
      [title]="conteo ? conteo + ' alertas sin leer' : 'Sin alertas pendientes'"
      [attr.aria-label]="conteo ? 'Alertas: ' + conteo + ' sin leer' : 'Alertas: ninguna sin leer'"
    >
      <mat-icon
        [matBadge]="conteo > 99 ? '99+' : conteo"
        [matBadgeHidden]="conteo === 0"
        matBadgeColor="warn"
        matBadgeSize="small"
        aria-hidden="true"
        >{{ conteo ? 'notifications_active' : 'notifications' }}</mat-icon
      >
    </a>
  `,
  styles: `
    a {
      color: inherit;
    }
  `,
})
export class AlertaBadgeComponent implements OnInit, OnDestroy {
  private readonly alertas = inject(AlertaService);
  private polling: Subscription | null = null;

  protected readonly noLeidas$ = this.alertas.noLeidas$;

  ngOnInit(): void {
    this.polling = interval(INTERVALO_POLLING_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.alertas.consultarResumen(true).pipe(catchError(() => EMPTY))),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.polling?.unsubscribe();
    this.polling = null;
  }
}
