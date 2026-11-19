import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <section class="not-found">
      <mat-icon class="icono" aria-hidden="true">travel_explore</mat-icon>
      <h1>404</h1>
      <h2>Página no encontrada</h2>
      <p>La página que buscas no existe o fue movida.</p>
      <a mat-flat-button routerLink="/dashboard">
        <mat-icon>dashboard</mat-icon>
        Volver al dashboard
      </a>
    </section>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 0.5rem;
      text-align: center;
    }
    h1 {
      font: var(--mat-sys-display-large);
      margin: 0;
      color: var(--mat-sys-primary);
    }
    h2 {
      font: var(--mat-sys-title-large);
      margin: 0;
    }
    p {
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 1rem;
    }
    .icono {
      font-size: 72px;
      width: 72px;
      height: 72px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class NotFoundComponent {}
