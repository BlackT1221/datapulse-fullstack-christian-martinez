import { DatePipe } from '@angular/common';
import { Component, computed, inject, Injector, input, OnDestroy, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/services/auth.service';
import { FormatoExportacion, Posicion } from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PortafolioService } from '../../../core/services/portafolio.service';
import { guardarArchivo } from '../../../core/utils/descarga';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';
import { MonedaUsdPipe } from '../../../shared/pipes';
import { DistribucionChartComponent } from '../distribucion-chart/distribucion-chart.component';
import { puedeEditar } from '../permisos';
import { DatosPosicionForm, PosicionFormComponent } from '../posicion-form/posicion-form.component';
import { MetricasPortafolioComponent } from './metricas-portafolio/metricas-portafolio.component';
import { segmentosPorPais, segmentosPorTipo } from './segmentos';
import { TablaPosicionesComponent } from './tabla-posiciones/tabla-posiciones.component';

const ETIQUETA_FORMATO: Readonly<Record<FormatoExportacion, string>> = { pdf: 'PDF', xlsx: 'Excel' };

@Component({
  selector: 'app-detalle-portafolio',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    EstadoCargaComponent,
    DistribucionChartComponent,
    MetricasPortafolioComponent,
    TablaPosicionesComponent,
    MonedaUsdPipe,
  ],
  templateUrl: './detalle.component.html',
  styleUrl: './detalle.component.scss',
})
export class DetalleComponent implements OnInit, OnDestroy {
  private readonly service = inject(PortafolioService);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly confirmacion = inject(ConfirmDialogService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);
  private readonly usuario = toSignal(inject(AuthService).usuario$, { initialValue: null });

  readonly id = input.required<string>();

  /** Estado reactivo compartido: se actualiza al agregar/editar/cerrar posiciones. */
  protected readonly portafolio = toSignal(this.service.portafolio$, { initialValue: null });
  protected readonly metricas = toSignal(this.service.metricas$, { initialValue: null });

  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly exportando = signal<FormatoExportacion | null>(null);

  protected readonly editable = computed(() => {
    const p = this.portafolio();
    return p !== null && puedeEditar(this.usuario(), p);
  });

  protected readonly segmentosPais = computed(() => {
    const m = this.metricas();
    const p = this.portafolio();
    return m && p ? segmentosPorPais(m, p.posiciones) : [];
  });

  protected readonly segmentosTipo = computed(() => {
    const m = this.metricas();
    return m ? segmentosPorTipo(m) : [];
  });

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.service.cerrar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.service.abrir(Number(this.id())).subscribe({
      next: () => this.cargando.set(false),
      error: () => {
        this.cargando.set(false);
        this.error.set(true);
      },
    });
  }

  protected abrirFormulario(posicion?: Posicion): void {
    const portafolio = this.portafolio();
    if (!portafolio) return;
    // `injector` hace visibles al diálogo los providers de la ruta (DateAdapter del datepicker).
    this.dialog.open<PosicionFormComponent, DatosPosicionForm>(PosicionFormComponent, {
      data: { portafolioId: portafolio.id, posicion },
      injector: this.injector,
      width: '640px',
      maxWidth: '95vw',
      autoFocus: 'first-tabbable',
    });
  }

  protected cerrarPosicion(posicion: Posicion): void {
    const portafolio = this.portafolio();
    if (!portafolio) return;
    this.confirmacion
      .confirmar({
        titulo: 'Cerrar posición',
        mensaje: `Se cerrará la posición de ${posicion.tipo_activo_display} en ${posicion.pais_nombre} con fecha de salida hoy. Dejará de sumar al monto activo.`,
        textoConfirmar: 'Cerrar posición',
        peligroso: true,
        icono: 'logout',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.service.cerrarPosicion(portafolio.id, posicion.id)),
      )
      .subscribe(() => this.notificacion.exito('Posición cerrada.'));
  }

  protected eliminar(): void {
    const portafolio = this.portafolio();
    if (!portafolio) return;
    this.confirmacion
      .confirmar({
        titulo: 'Eliminar portafolio',
        mensaje: `¿Seguro que deseas eliminar "${portafolio.nombre}"? Dejará de estar visible para todos los usuarios.`,
        textoConfirmar: 'Eliminar',
        peligroso: true,
        icono: 'delete',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.service.eliminar(portafolio.id)),
      )
      .subscribe(() => {
        this.notificacion.exito(`Portafolio "${portafolio.nombre}" eliminado.`);
        void this.router.navigate(['/portafolios']);
      });
  }

  protected exportar(formato: FormatoExportacion): void {
    const portafolio = this.portafolio();
    if (!portafolio || this.exportando()) return;
    this.exportando.set(formato);
    this.service.exportar(portafolio.id, formato).subscribe({
      next: (respuesta) => {
        guardarArchivo(respuesta, `portafolio-${portafolio.id}.${formato}`);
        this.notificacion.exito(`Reporte ${ETIQUETA_FORMATO[formato]} descargado.`);
        this.exportando.set(null);
      },
      error: () => this.exportando.set(null),
    });
  }
}
