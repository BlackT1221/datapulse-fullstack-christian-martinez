import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/services/auth.service';
import { FiltrosPortafolio, Portafolio } from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PortafolioService } from '../../../core/services/portafolio.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';
import { TieneRolDirective } from '../../../shared/directives/tiene-rol.directive';
import { MonedaUsdPipe } from '../../../shared/pipes';
import { puedeEditar, ROLES_EDICION } from '../permisos';

type Alcance = 'todos' | 'propios' | 'otros';

const ALCANCE_A_FILTRO: Readonly<Record<Alcance, boolean | undefined>> = {
  todos: undefined,
  propios: true,
  otros: false,
};

@Component({
  selector: 'app-lista-portafolios',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    EstadoCargaComponent,
    TieneRolDirective,
    MonedaUsdPipe,
  ],
  templateUrl: './lista.component.html',
  styleUrl: './lista.component.scss',
})
export class ListaComponent {
  private readonly service = inject(PortafolioService);
  private readonly confirmacion = inject(ConfirmDialogService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);
  private readonly usuario = toSignal(inject(AuthService).usuario$, { initialValue: null });

  protected readonly rolesEdicion = ROLES_EDICION;
  protected readonly columnas = [
    'nombre',
    'visibilidad',
    'propietario',
    'posiciones',
    'monto',
    'modificado',
    'acciones',
  ];

  protected readonly form = inject(NonNullableFormBuilder).group({
    search: [''],
    alcance: ['todos' as Alcance],
  });

  private readonly filtros = signal<{ search: string; alcance: Alcance }>({
    search: '',
    alcance: 'todos',
  });
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(20);
  protected readonly orden = signal<Sort>({ active: 'fecha_modificacion', direction: 'desc' });

  protected readonly portafolios = rxResource({
    params: (): FiltrosPortafolio => ({
      search: this.filtros().search,
      propios: ALCANCE_A_FILTRO[this.filtros().alcance],
      page: this.pagina() + 1,
      page_size: this.tamano(),
      ordering: this.ordering(this.orden()),
    }),
    stream: ({ params }) => this.service.listar(params),
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        map(() => this.form.getRawValue()),
        distinctUntilChanged((a, b) => a.search.trim() === b.search.trim() && a.alcance === b.alcance),
        takeUntilDestroyed(),
      )
      .subscribe(({ search, alcance }) => {
        this.pagina.set(0);
        this.filtros.set({ search: search.trim(), alcance });
      });
  }

  protected editable(portafolio: Portafolio): boolean {
    return puedeEditar(this.usuario(), portafolio);
  }

  protected verDetalle(portafolio: Portafolio): void {
    void this.router.navigate(['/portafolios', portafolio.id]);
  }

  protected eliminar(portafolio: Portafolio, evento: Event): void {
    evento.stopPropagation();
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
        this.portafolios.reload();
      });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.tamano.set(evento.pageSize);
    this.pagina.set(evento.pageIndex);
  }

  protected ordenar(orden: Sort): void {
    this.pagina.set(0);
    this.orden.set(orden);
  }

  private ordering(orden: Sort): string | undefined {
    if (!orden.direction) return undefined;
    return orden.direction === 'desc' ? `-${orden.active}` : orden.active;
  }
}
