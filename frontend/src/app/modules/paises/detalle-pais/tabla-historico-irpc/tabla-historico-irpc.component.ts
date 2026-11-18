import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';

import { IndiceRiesgoBase } from '../../../../core/models';
import { NivelRiesgoPipe } from '../../../../shared/pipes';

@Component({
  selector: 'app-tabla-historico-irpc',
  imports: [DatePipe, DecimalPipe, MatCardModule, MatTableModule, NivelRiesgoPipe],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Histórico del IRPC</mat-card-title>
        <mat-card-subtitle>Cálculos más recientes (máx. 12)</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="contenido">
        <table mat-table [dataSource]="historico()" aria-label="Histórico de cálculos del IRPC">
          <ng-container matColumnDef="fecha">
            <th mat-header-cell *matHeaderCellDef>Fecha de cálculo</th>
            <td mat-cell *matCellDef="let f">{{ f.fecha_calculo | date: 'd MMM y, HH:mm' }}</td>
          </ng-container>
          <ng-container matColumnDef="economico">
            <th mat-header-cell *matHeaderCellDef class="num">Económico</th>
            <td mat-cell *matCellDef="let f" class="num">
              {{ f.score_economico | number: '1.0-1' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="cambiario">
            <th mat-header-cell *matHeaderCellDef class="num">Cambiario</th>
            <td mat-cell *matCellDef="let f" class="num">
              {{ f.score_cambiario | number: '1.0-1' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="estabilidad">
            <th mat-header-cell *matHeaderCellDef class="num">Estabilidad</th>
            <td mat-cell *matCellDef="let f" class="num">
              {{ f.score_estabilidad | number: '1.0-1' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="irpc">
            <th mat-header-cell *matHeaderCellDef class="num">IRPC</th>
            <td mat-cell *matCellDef="let f" class="num">
              <strong>{{ f.indice_compuesto | number: '1.1-1' }}</strong>
            </td>
          </ng-container>
          <ng-container matColumnDef="nivel">
            <th mat-header-cell *matHeaderCellDef>Nivel</th>
            <td mat-cell *matCellDef="let f">
              <span class="nivel"
                ><span class="punto" [style.background-color]="f.color"></span
                >{{ f.nivel_riesgo | nivelRiesgo }}</span
              >
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columnas"></tr>
          <tr mat-row *matRowDef="let f; columns: columnas"></tr>
          <tr class="mat-row" *matNoDataRow>
            <td class="vacio" [attr.colspan]="columnas.length">Sin cálculos registrados.</td>
          </tr>
        </table>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .contenido {
      overflow-x: auto;
      padding-top: 0.5rem;
    }
    table {
      width: 100%;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .nivel {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      white-space: nowrap;
    }
    .punto {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .vacio {
      padding: 1.5rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class TablaHistoricoIrpcComponent {
  readonly historico = input.required<IndiceRiesgoBase[]>();
  protected readonly columnas = ['fecha', 'economico', 'cambiario', 'estabilidad', 'irpc', 'nivel'];
}
