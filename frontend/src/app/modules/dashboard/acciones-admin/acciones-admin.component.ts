import { Component, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { filter, finalize, Observable, switchMap } from 'rxjs';

import { ResultadoRecalculo, ResultadoSincronizacion } from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PaisService } from '../../../core/services/pais.service';
import { RiesgoService } from '../../../core/services/riesgo.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { DatosConfirmacion } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

type Accion = 'sincronizar' | 'recalcular';

/** Botones de ADMIN: sincronizar datos externos y recalcular el IRPC. Emite `completado` al terminar. */
@Component({
  selector: 'app-acciones-admin',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './acciones-admin.component.html',
  styleUrl: './acciones-admin.component.scss',
})
export class AccionesAdminComponent {
  private readonly paises = inject(PaisService);
  private readonly riesgo = inject(RiesgoService);
  private readonly confirmacion = inject(ConfirmDialogService);
  private readonly notificacion = inject(NotificacionService);

  readonly completado = output<void>();
  protected readonly enCurso = signal<Accion | null>(null);

  protected sincronizar(): void {
    this.ejecutar(
      'sincronizar',
      {
        titulo: 'Sincronizar datos externos',
        mensaje:
          'Se consultarán World Bank y ExchangeRate-API para los 10 países y luego se recalculará ' +
          'el IRPC. El proceso puede tardar hasta un par de minutos.',
        textoConfirmar: 'Sincronizar',
        icono: 'sync',
      },
      () => this.paises.sincronizarIndicadores(),
      (r: ResultadoSincronizacion) => {
        const errores = r.indicadores.errores.length + r.tipos_cambio.errores.length + r.irpc.errores.length;
        const resumen =
          `Sincronización completada: ${r.indicadores.actualizados} indicadores y ` +
          `${r.tipos_cambio.actualizados} tipos de cambio actualizados, ${r.irpc.calculados} IRPC calculados.`;
        this.informar(resumen, errores);
      },
    );
  }

  protected recalcular(): void {
    this.ejecutar(
      'recalcular',
      {
        titulo: 'Recalcular IRPC',
        mensaje: 'Se recalculará el Índice de Riesgo País Compuesto de todos los países con los datos actuales.',
        textoConfirmar: 'Recalcular',
        icono: 'calculate',
      },
      () => this.riesgo.recalcular(),
      (r: ResultadoRecalculo) =>
        this.informar(`Recálculo completado: ${r.calculados} países actualizados.`, r.errores.length),
    );
  }

  private ejecutar<T>(
    accion: Accion,
    datos: DatosConfirmacion,
    solicitud: () => Observable<T>,
    alTerminar: (resultado: T) => void,
  ): void {
    if (this.enCurso()) return;
    this.confirmacion
      .confirmar(datos)
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.enCurso.set(accion);
          return solicitud().pipe(finalize(() => this.enCurso.set(null)));
        }),
      )
      .subscribe({
        next: (resultado) => {
          alTerminar(resultado);
          this.completado.emit();
        },
        // El interceptor global ya muestra el mensaje de error.
        error: () => undefined,
      });
  }

  private informar(resumen: string, errores: number): void {
    if (errores > 0) {
      this.notificacion.advertencia(`${resumen} Se registraron ${errores} errores parciales.`);
    } else {
      this.notificacion.exito(resumen);
    }
  }
}
