import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Posicion } from '../../../../core/models';
import { MonedaUsdPipe } from '../../../../shared/pipes';

/** Posiciones del portafolio con acciones de edición / cierre (solo si `editable`). */
@Component({
  selector: 'app-tabla-posiciones',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
    MonedaUsdPipe,
  ],
  templateUrl: './tabla-posiciones.component.html',
  styleUrl: './tabla-posiciones.component.scss',
})
export class TablaPosicionesComponent {
  readonly posiciones = input.required<readonly Posicion[]>();
  readonly editable = input(false);
  readonly editar = output<Posicion>();
  readonly cerrar = output<Posicion>();

  protected readonly mostrarCerradas = signal(false);

  protected readonly visibles = computed(() => {
    const lista = this.mostrarCerradas()
      ? this.posiciones()
      : this.posiciones().filter((p) => p.fecha_salida === null);
    // Activas primero, luego por fecha de entrada descendente.
    return [...lista].sort(
      (a, b) =>
        Number(a.fecha_salida !== null) - Number(b.fecha_salida !== null) ||
        b.fecha_entrada.localeCompare(a.fecha_entrada),
    );
  });

  protected readonly cerradas = computed(
    () => this.posiciones().filter((p) => p.fecha_salida !== null).length,
  );

  protected readonly columnas = computed(() => {
    const base = ['pais', 'tipo', 'entrada', 'monto', 'estado', 'notas'];
    return this.editable() ? [...base, 'acciones'] : base;
  });
}
