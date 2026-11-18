import { Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LoadingService } from '../../../core/services/loading.service';

/**
 * - `modo="global"`: barra superior fija enlazada al `LoadingService` (solicitudes HTTP en curso).
 * - `modo="inline"` (por defecto): spinner centrado para estados de carga locales.
 */
@Component({
  selector: 'app-loading-spinner',
  imports: [MatProgressBarModule, MatProgressSpinnerModule],
  template: `
    @if (modo() === 'global') {
      @if (cargandoGlobal()) {
        <mat-progress-bar class="barra-global" mode="indeterminate" aria-label="Cargando" />
      }
    } @else {
      <div class="spinner" role="status" aria-live="polite">
        <mat-spinner [diameter]="diametro()" />
        @if (mensaje()) {
          <p>{{ mensaje() }}</p>
        }
      </div>
    }
  `,
  styles: `
    .barra-global {
      position: fixed;
      inset: 0 0 auto 0;
      z-index: 1100;
    }
    .spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 2rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class LoadingSpinnerComponent {
  readonly modo = input<'global' | 'inline'>('inline');
  readonly diametro = input(48);
  readonly mensaje = input<string>('');

  protected readonly cargandoGlobal = toSignal(inject(LoadingService).cargando$, {
    initialValue: false,
  });
}
