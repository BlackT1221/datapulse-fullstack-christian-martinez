import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

/** Estados de carga / error / vacío homogéneos para tarjetas y secciones. */
@Component({
  selector: 'app-estado-carga',
  imports: [MatButtonModule, MatIconModule, LoadingSpinnerComponent],
  template: `
    @if (cargando()) {
      <app-loading-spinner [diametro]="36" [mensaje]="mensajeCarga()" />
    } @else if (error()) {
      <div class="estado" role="alert">
        <mat-icon class="icono-error">cloud_off</mat-icon>
        <p>{{ mensajeError() }}</p>
        <button mat-stroked-button type="button" (click)="reintentar.emit()">
          <mat-icon>refresh</mat-icon>
          Reintentar
        </button>
      </div>
    } @else if (vacio()) {
      <div class="estado">
        <mat-icon>inbox</mat-icon>
        <p>{{ mensajeVacio() }}</p>
      </div>
    }
  `,
  styles: `
    .estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    p {
      margin: 0;
    }
    .icono-error {
      color: var(--mat-sys-error);
    }
  `,
})
export class EstadoCargaComponent {
  readonly cargando = input(false);
  readonly error = input(false);
  readonly vacio = input(false);
  readonly mensajeCarga = input('Cargando...');
  readonly mensajeError = input('No se pudo cargar la información.');
  readonly mensajeVacio = input('No hay datos disponibles.');
  readonly reintentar = output<void>();
}
