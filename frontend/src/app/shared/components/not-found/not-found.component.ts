import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [MatButtonModule, RouterLink],
  template: `
    <section class="not-found">
      <h1>404</h1>
      <p>La página que buscas no existe.</p>
      <a mat-flat-button routerLink="/">Volver al inicio</a>
    </section>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 1rem;
      text-align: center;
    }
  `,
})
export class NotFoundComponent {}
