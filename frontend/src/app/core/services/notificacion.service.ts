import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

type TipoNotificacion = 'exito' | 'error' | 'advertencia' | 'info';

const DURACION_MS: Readonly<Record<TipoNotificacion, number>> = {
  exito: 3000,
  info: 4000,
  advertencia: 5000,
  error: 6000,
};

/** Envoltorio de `MatSnackBar` con estilos consistentes por tipo de mensaje. */
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly snackBar = inject(MatSnackBar);

  exito(mensaje: string): void {
    this.mostrar(mensaje, 'exito');
  }

  error(mensaje: string): void {
    this.mostrar(mensaje, 'error');
  }

  advertencia(mensaje: string): void {
    this.mostrar(mensaje, 'advertencia');
  }

  info(mensaje: string): void {
    this.mostrar(mensaje, 'info');
  }

  private mostrar(mensaje: string, tipo: TipoNotificacion): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: DURACION_MS[tipo],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['notificacion', `notificacion--${tipo}`],
    });
  }
}
