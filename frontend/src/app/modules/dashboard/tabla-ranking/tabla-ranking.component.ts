import { DecimalPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { RankingRiesgo, Tendencia } from '../../../core/models';
import { NivelRiesgoPipe } from '../../../shared/pipes';

interface InfoTendencia {
  icono: string;
  etiqueta: string;
  clase: string;
}

const TENDENCIAS: Readonly<Record<Tendencia, InfoTendencia>> = {
  SUBE: { icono: 'trending_up', etiqueta: 'Mejora (sube el IRPC)', clase: 'sube' },
  BAJA: { icono: 'trending_down', etiqueta: 'Empeora (baja el IRPC)', clase: 'baja' },
  ESTABLE: { icono: 'trending_flat', etiqueta: 'Estable', clase: 'estable' },
};

@Component({
  selector: 'app-tabla-ranking',
  imports: [
    DecimalPipe,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    NivelRiesgoPipe,
  ],
  templateUrl: './tabla-ranking.component.html',
  styleUrl: './tabla-ranking.component.scss',
})
export class TablaRankingComponent {
  private readonly router = inject(Router);

  readonly ranking = input.required<RankingRiesgo[]>();

  protected readonly columnas = ['posicion', 'pais', 'irpc', 'nivel', 'variacion', 'tendencia'];

  protected tendencia(fila: RankingRiesgo): InfoTendencia | null {
    return fila.tendencia ? TENDENCIAS[fila.tendencia] : null;
  }

  protected irpc(fila: RankingRiesgo): number {
    return Number(fila.indice_compuesto);
  }

  protected verDetalle(fila: RankingRiesgo): void {
    void this.router.navigate(['/paises', fila.pais]);
  }
}
