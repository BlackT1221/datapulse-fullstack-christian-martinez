import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import {
  Alerta,
  ETIQUETAS_TIPO_ALERTA,
  FiltrosAlerta,
  Severidad,
  SEVERIDADES,
  TipoAlerta,
} from '../../../core/models';
import { AlertaService } from '../../../core/services/alerta.service';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';

type EstadoLectura = 'todas' | 'no_leidas' | 'leidas';

const LECTURA_A_FILTRO: Readonly<Record<EstadoLectura, boolean | undefined>> = {
  todas: undefined,
  no_leidas: false,
  leidas: true,
};

@Component({
  selector: 'app-panel-alertas',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTooltipModule,
    EstadoCargaComponent,
  ],
  templateUrl: './panel-alertas.component.html',
  styleUrl: './panel-alertas.component.scss',
})
export class PanelAlertasComponent implements OnInit {
  private readonly service = inject(AlertaService);
  private readonly confirmacion = inject(ConfirmDialogService);
  private readonly notificacion = inject(NotificacionService);

  protected readonly severidades = SEVERIDADES;
  protected readonly tipos = (Object.keys(ETIQUETAS_TIPO_ALERTA) as TipoAlerta[]).map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_TIPO_ALERTA[valor],
  }));
  protected readonly opcionesSeveridad = (Object.keys(SEVERIDADES) as Severidad[]).map((valor) => ({
    valor,
    ...SEVERIDADES[valor],
  }));

  protected readonly estado = toSignal(this.service.estado$, { requireSync: true });
  protected readonly resumen = toSignal(this.service.resumen$, { requireSync: true });
  protected readonly hayNuevas = toSignal(this.service.hayNuevas$, { requireSync: true });
  protected readonly noLeidas = computed(() => this.resumen()?.no_leidas ?? 0);

  protected readonly form = inject(NonNullableFormBuilder).group({
    lectura: ['todas' as EstadoLectura],
    tipo: ['' as TipoAlerta | ''],
    severidad: ['' as Severidad | ''],
  });

  private readonly valoresFiltro = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly filtrosActivos = computed(() => {
    const f = this.valoresFiltro();
    return f.lectura !== 'todas' || !!f.tipo || !!f.severidad;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.aplicarFiltros());
  }

  ngOnInit(): void {
    this.aplicarFiltros();
    this.service.consultarResumen(true).subscribe({ error: () => undefined });
  }

  protected actualizar(): void {
    this.service.cargar();
  }

  protected limpiarFiltros(): void {
    this.form.reset({ lectura: 'todas', tipo: '', severidad: '' });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.service.cargar({ page: evento.pageIndex + 1, page_size: evento.pageSize });
  }

  protected leer(alerta: Alerta): void {
    if (alerta.leida) return;
    this.service.leer(alerta).subscribe({ error: () => undefined });
  }

  protected leerTodas(): void {
    const pendientes = this.noLeidas();
    this.confirmacion
      .confirmar({
        titulo: 'Marcar todas como leídas',
        mensaje: `Se marcarán ${pendientes} alertas como leídas. Esta acción no se puede deshacer.`,
        textoConfirmar: 'Marcar todas',
        icono: 'done_all',
      })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.service.leerTodas().subscribe({
          next: (r) => this.notificacion.exito(`${r.actualizadas} alertas marcadas como leídas.`),
          error: () => undefined,
        }),
      );
  }

  protected etiquetaTipo(tipo: TipoAlerta): string {
    return ETIQUETAS_TIPO_ALERTA[tipo];
  }

  private aplicarFiltros(): void {
    const { lectura, tipo, severidad } = this.form.getRawValue();
    const filtros: Partial<FiltrosAlerta> = {
      page: 1,
      leida: LECTURA_A_FILTRO[lectura],
      tipo: tipo || undefined,
      severidad: severidad || undefined,
    };
    this.service.cargar(filtros);
  }
}
