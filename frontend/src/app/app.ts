import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/services/auth.service';
import { ETIQUETAS_ROL } from './core/models';
import { AlertaService } from './core/services/alerta.service';
import { AlertaBadgeComponent } from './modules/alertas/alerta-badge/alerta-badge.component';
import { LoadingSpinnerComponent } from './shared/components/loading-spinner/loading-spinner.component';

@Component({
  imports: [
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    LoadingSpinnerComponent,
    AlertaBadgeComponent,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);

  protected readonly titulo = 'DataPulse Latam';
  protected readonly etiquetasRol = ETIQUETAS_ROL;
  protected readonly usuario$ = this.auth.usuario$;

  constructor() {
    // Al cerrar sesión (manual o por 401) se descarta el estado de alertas del usuario anterior.
    const alertas = inject(AlertaService);
    this.usuario$.pipe(takeUntilDestroyed()).subscribe((usuario) => {
      if (usuario === null) alertas.reiniciar();
    });
  }

  protected cerrarSesion(): void {
    this.auth.logout();
  }
}
