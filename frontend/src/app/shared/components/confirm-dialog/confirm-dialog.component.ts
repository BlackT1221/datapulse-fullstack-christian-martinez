import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface DatosConfirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Resalta la acción como destructiva (eliminar, cerrar posición...). */
  peligroso?: boolean;
  icono?: string;
}

/** Diálogo genérico de confirmación. Se cierra con `true` (confirmar) o `false` (cancelar). */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="titulo">
      <mat-icon [class.peligro]="datos.peligroso">{{ icono }}</mat-icon>
      {{ datos.titulo }}
    </h2>
    <mat-dialog-content>
      <p>{{ datos.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">
        {{ datos.textoCancelar ?? 'Cancelar' }}
      </button>
      <button
        mat-flat-button
        type="button"
        cdkFocusInitial
        [class.boton-peligro]="datos.peligroso"
        [mat-dialog-close]="true"
      >
        {{ datos.textoConfirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .titulo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .peligro {
      color: var(--mat-sys-error);
    }
    .boton-peligro {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly datos = inject<DatosConfirmacion>(MAT_DIALOG_DATA);
  protected readonly icono = this.datos.icono ?? (this.datos.peligroso ? 'warning' : 'help');
}
