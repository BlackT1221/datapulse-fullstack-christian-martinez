import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { map, Observable, startWith } from 'rxjs';

import {
  ETIQUETAS_TIPO_ACTIVO,
  MONTO_MAXIMO_ACTIVO_PORTAFOLIO,
  MONTO_MAXIMO_POSICION,
  MONTO_MINIMO_POSICION,
  NIVELES_RIESGO,
  NOTAS_POSICION_MAX,
  Pais,
  Posicion,
  PosicionPayload,
  TipoActivo,
} from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PortafolioService } from '../../../core/services/portafolio.service';
import { aplicarErroresServidor, extraerMensajeError } from '../../../core/utils/errores-api';
import { aFechaIso, desdeFechaIso, hoy } from '../../../core/utils/fechas';
import { calcularMetricas, catalogoRiesgo } from '../../../core/utils/metricas-portafolio';
import { MontoMilesDirective } from '../../../shared/directives/monto-miles.directive';
import { MonedaUsdPipe } from '../../../shared/pipes';
import { fechaNoFutura, opcionSeleccionada } from '../../../shared/validators/validadores';
import {
  ErrorCruzadoMatcher,
  ErrorLimiteMonto,
  ErrorPosicionesIguales,
  esDolarizado,
  esPais,
  validacionesCruzadas,
} from './validaciones-cruzadas';

export interface DatosPosicionForm {
  portafolioId: number;
  /** Posición a editar; ausente al crear. */
  posicion?: Posicion;
}

const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Diálogo para agregar / editar una posición. Lee posiciones y países del estado del servicio. */
@Component({
  selector: 'app-posicion-form',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MontoMilesDirective,
    MonedaUsdPipe,
  ],
  templateUrl: './posicion-form.component.html',
  styleUrl: './posicion-form.component.scss',
})
export class PosicionFormComponent {
  private readonly service = inject(PortafolioService);
  private readonly notificacion = inject(NotificacionService);
  private readonly dialogRef = inject<MatDialogRef<PosicionFormComponent, Posicion>>(MatDialogRef);
  protected readonly datos = inject<DatosPosicionForm>(MAT_DIALOG_DATA);

  protected readonly editando = this.datos.posicion !== undefined;
  protected readonly hoy = hoy();
  protected readonly limites = {
    min: MONTO_MINIMO_POSICION,
    max: MONTO_MAXIMO_POSICION,
    portafolio: MONTO_MAXIMO_ACTIVO_PORTAFOLIO,
    notas: NOTAS_POSICION_MAX,
  };
  protected readonly tiposActivo = (Object.keys(ETIQUETAS_TIPO_ACTIVO) as TipoActivo[]).map(
    (valor) => ({ valor, etiqueta: ETIQUETAS_TIPO_ACTIVO[valor] }),
  );
  private readonly paises = this.service.paisesActuales;
  private readonly posiciones = this.service.portafolioActual?.posiciones ?? [];

  protected readonly form = new FormGroup(
    {
      pais: new FormControl<Pais | string | null>(this.paisInicial(), [
        Validators.required,
        opcionSeleccionada,
      ]),
      tipo_activo: new FormControl<TipoActivo | null>(this.datos.posicion?.tipo_activo ?? null, [
        Validators.required,
      ]),
      monto_inversion_usd: new FormControl<number | null>(
        this.datos.posicion ? Number(this.datos.posicion.monto_inversion_usd) : null,
        [Validators.required, Validators.min(MONTO_MINIMO_POSICION), Validators.max(MONTO_MAXIMO_POSICION)],
      ),
      fecha_entrada: new FormControl<Date | null>(
        this.datos.posicion ? desdeFechaIso(this.datos.posicion.fecha_entrada) : this.hoy,
        [Validators.required, fechaNoFutura],
      ),
      notas: new FormControl(this.datos.posicion?.notas ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(NOTAS_POSICION_MAX)],
      }),
    },
    {
      validators: validacionesCruzadas(() => ({
        posiciones: this.posiciones,
        editandoId: this.datos.posicion?.id,
      })),
    },
  );

  protected readonly matcherTipo = new ErrorCruzadoMatcher(['monedaDolarizada', 'maxPosicionesIguales']);
  protected readonly matcherMonto = new ErrorCruzadoMatcher(['limiteMonto']);

  private readonly valor = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  protected readonly paisSeleccionado = computed(() => {
    const pais = this.valor().pais;
    return esPais(pais) ? pais : null;
  });
  protected readonly dolarizado = computed(() => esDolarizado(this.paisSeleccionado()));

  protected readonly opcionesPais = computed(() => {
    const texto = this.valor().pais;
    const filtro = typeof texto === 'string' ? normalizar(texto) : '';
    return this.paises.filter(
      (p) => !filtro || normalizar(`${p.nombre} ${p.codigo_iso} ${p.moneda_codigo}`).includes(filtro),
    );
  });

  /** Proyección en tiempo real del portafolio si se guarda la posición tal como está. */
  protected readonly proyeccion = computed(() => {
    const { pais, tipo_activo, monto_inversion_usd } = this.valor();
    const base = this.posiciones.filter((p) => p.id !== this.datos.posicion?.id);
    const borrador =
      esPais(pais) && tipo_activo && monto_inversion_usd
        ? [{ pais: pais.codigo_iso, tipo_activo, monto_inversion_usd, fecha_salida: null }]
        : [];
    const metricas = calcularMetricas([...base, ...borrador], catalogoRiesgo(this.paises));
    const nivel = metricas.nivel_riesgo ? NIVELES_RIESGO[metricas.nivel_riesgo] : null;
    return {
      ...metricas,
      nivel,
      porcentajeLimite: Math.min(100, (metricas.monto_total_activo / MONTO_MAXIMO_ACTIVO_PORTAFOLIO) * 100),
      excede: metricas.monto_total_activo > MONTO_MAXIMO_ACTIVO_PORTAFOLIO,
    };
  });

  protected readonly guardando = signal(false);
  protected readonly erroresGenerales = signal<string[]>([]);

  protected readonly mostrarPais = (pais: Pais | string | null): string =>
    esPais(pais) ? pais.nombre : (pais ?? '');

  protected errorLimite(): ErrorLimiteMonto | null {
    return (this.form.getError('limiteMonto') as ErrorLimiteMonto | null) ?? null;
  }

  protected errorIguales(): ErrorPosicionesIguales | null {
    return (this.form.getError('maxPosicionesIguales') as ErrorPosicionesIguales | null) ?? null;
  }

  protected irpcDe(pais: Pais): string | null {
    return pais.irpc === null ? null : Number(pais.irpc).toFixed(1);
  }

  /** Bloquea el envío (sin request) mientras exista cualquier error, incluidas las reglas cruzadas. */
  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (!esPais(v.pais) || !v.tipo_activo || v.monto_inversion_usd === null || !v.fecha_entrada) {
      return;
    }
    const payload: PosicionPayload = {
      pais: v.pais.codigo_iso,
      tipo_activo: v.tipo_activo,
      monto_inversion_usd: v.monto_inversion_usd.toFixed(2),
      fecha_entrada: aFechaIso(v.fecha_entrada),
      notas: v.notas.trim(),
    };
    this.enviar(payload);
  }

  private enviar(payload: PosicionPayload): void {
    const { portafolioId, posicion } = this.datos;
    const solicitud: Observable<Posicion> = posicion
      ? this.service.editarPosicion(portafolioId, posicion.id, payload)
      : this.service.agregarPosicion(portafolioId, payload);
    this.guardando.set(true);
    this.erroresGenerales.set([]);
    solicitud.subscribe({
      next: (guardada) => {
        this.notificacion.exito(posicion ? 'Posición actualizada.' : 'Posición agregada al portafolio.');
        this.dialogRef.close(guardada);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.erroresGenerales.set(
          error.status === 400 ? aplicarErroresServidor(this.form, error) : [extraerMensajeError(error)],
        );
      },
    });
  }

  private paisInicial(): Pais | null {
    const iso = this.datos.posicion?.pais;
    return iso ? (this.service.paisesActuales.find((p) => p.codigo_iso === iso) ?? null) : null;
  }
}
