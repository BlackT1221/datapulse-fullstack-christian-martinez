import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { ETIQUETAS_REGION, Pais, Region } from '../../../core/models';
import { PaisService } from '../../../core/services/pais.service';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';
import { NivelRiesgoPipe, NumeroCompactoPipe } from '../../../shared/pipes';

interface Filtros {
  search: string;
  region: Region | '';
}

const TAMANO_PAGINA = 10;

@Component({
  selector: 'app-lista-paises',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    EstadoCargaComponent,
    NivelRiesgoPipe,
    NumeroCompactoPipe,
  ],
  templateUrl: './lista-paises.component.html',
  styleUrl: './lista-paises.component.scss',
})
export class ListaPaisesComponent {
  private readonly paisService = inject(PaisService);
  private readonly router = inject(Router);

  protected readonly columnas = ['pais', 'region', 'moneda', 'poblacion', 'irpc', 'nivel'];
  protected readonly regiones = (Object.keys(ETIQUETAS_REGION) as Region[]).map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_REGION[valor],
  }));

  protected readonly form = inject(NonNullableFormBuilder).group({
    search: [''],
    region: ['' as Region | ''],
  });

  private readonly filtros = signal<Filtros>({ search: '', region: '' });
  protected readonly pagina = signal(0);
  protected readonly tamano = signal(TAMANO_PAGINA);
  protected readonly orden = signal<Sort>({ active: 'nombre', direction: 'asc' });

  protected readonly paises = rxResource({
    params: () => ({
      ...this.filtros(),
      page: this.pagina() + 1,
      page_size: this.tamano(),
      ordering: this.ordering(this.orden()),
    }),
    stream: ({ params }) =>
      this.paisService.listar({ ...params, region: params.region || undefined }),
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        map(() => this.form.getRawValue()),
        distinctUntilChanged(
          (a, b) => a.search.trim() === b.search.trim() && a.region === b.region,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ search, region }) => {
        this.pagina.set(0);
        this.filtros.set({ search: search.trim(), region });
      });
  }

  protected limpiar(): void {
    this.form.reset({ search: '', region: '' });
  }

  protected cambiarPagina(evento: PageEvent): void {
    this.tamano.set(evento.pageSize);
    this.pagina.set(evento.pageIndex);
  }

  protected ordenar(orden: Sort): void {
    this.pagina.set(0);
    this.orden.set(orden);
  }

  protected verDetalle(pais: Pais): void {
    void this.router.navigate(['/paises', pais.codigo_iso]);
  }

  protected etiquetaRegion(region: Region): string {
    return ETIQUETAS_REGION[region];
  }

  private ordering(orden: Sort): string | undefined {
    if (!orden.direction) return undefined;
    return orden.direction === 'desc' ? `-${orden.active}` : orden.active;
  }
}
