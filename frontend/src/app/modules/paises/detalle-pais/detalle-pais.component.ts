import { DecimalPipe } from '@angular/common';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { catchError, map, of, throwError } from 'rxjs';

import { OMITIR_NOTIFICACION_ERROR } from '../../../core/interceptors/contexto-http';
import { ETIQUETAS_REGION, NIVELES_RIESGO, NivelRiesgo, Region } from '../../../core/models';
import { PaisService } from '../../../core/services/pais.service';
import { RiesgoService } from '../../../core/services/riesgo.service';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';
import { NumeroCompactoPipe } from '../../../shared/pipes';
import { DesgloseIrpcComponent } from './desglose-irpc/desglose-irpc.component';
import { GraficoIndicadoresComponent } from './grafico-indicadores/grafico-indicadores.component';
import { GraficoTipoCambioComponent } from './grafico-tipo-cambio/grafico-tipo-cambio.component';
import { IndicadoresPaisComponent } from './indicadores-pais/indicadores-pais.component';
import { TablaHistoricoIrpcComponent } from './tabla-historico-irpc/tabla-historico-irpc.component';

const DIAS_TIPO_CAMBIO = 30;

@Component({
  selector: 'app-detalle-pais',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    RouterLink,
    EstadoCargaComponent,
    NumeroCompactoPipe,
    DesgloseIrpcComponent,
    GraficoIndicadoresComponent,
    GraficoTipoCambioComponent,
    IndicadoresPaisComponent,
    TablaHistoricoIrpcComponent,
  ],
  templateUrl: './detalle-pais.component.html',
  styleUrl: './detalle-pais.component.scss',
})
export class DetallePaisComponent {
  private readonly paisService = inject(PaisService);
  private readonly riesgoService = inject(RiesgoService);

  /** Parámetro de ruta `:codigoIso` (enlazado con `withComponentInputBinding`). */
  readonly codigoIso = input.required<string>();

  protected readonly pais = rxResource({
    params: () => this.codigoIso(),
    stream: ({ params }) => this.paisService.obtener(params),
  });

  /** `null` si el país aún no tiene IRPC calculado (404), sin mostrar snackbar. */
  protected readonly riesgo = rxResource({
    params: () => this.codigoIso(),
    stream: ({ params }) =>
      this.riesgoService
        .detalle(params, new HttpContext().set(OMITIR_NOTIFICACION_ERROR, true))
        .pipe(
          catchError((error: unknown) =>
            error instanceof HttpErrorResponse && error.status === 404
              ? of(null)
              : throwError(() => error),
          ),
        ),
  });

  protected readonly indicadores = rxResource({
    params: () => this.codigoIso(),
    stream: ({ params }) =>
      this.paisService
        .indicadores(params, { page_size: 100, ordering: 'anio' })
        .pipe(map((p) => p.results)),
  });

  /** Últimos 30 registros disponibles, en orden cronológico. */
  protected readonly tipoCambio = rxResource({
    params: () => this.codigoIso(),
    stream: ({ params }) =>
      this.paisService
        .tipoCambio(params, { ordering: '-fecha', page_size: DIAS_TIPO_CAMBIO })
        .pipe(map((p) => [...p.results].reverse())),
  });

  protected region(region: Region): string {
    return ETIQUETAS_REGION[region];
  }

  protected nivel(nivel: NivelRiesgo) {
    return NIVELES_RIESGO[nivel];
  }
}
