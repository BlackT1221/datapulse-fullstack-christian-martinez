import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';

import { ConfirmDialogComponent, DatosConfirmacion } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  /** Emite `true` solo si el usuario confirma explícitamente. */
  confirmar(datos: DatosConfirmacion): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, DatosConfirmacion, boolean>(ConfirmDialogComponent, {
        data: datos,
        width: '440px',
        maxWidth: '95vw',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .pipe(map((resultado) => resultado === true));
  }
}
