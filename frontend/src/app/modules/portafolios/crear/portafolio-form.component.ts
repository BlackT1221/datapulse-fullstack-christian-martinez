import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { filter, first, Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/services/auth.service';
import {
  DESCRIPCION_PORTAFOLIO_MAX,
  FechaHoraIso,
  NOMBRE_PORTAFOLIO_MAX,
  NOMBRE_PORTAFOLIO_MIN,
  Portafolio,
  PortafolioDetalle,
  PortafolioPayload,
} from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PortafolioService } from '../../../core/services/portafolio.service';
import { aplicarErroresServidor, extraerMensajeError } from '../../../core/utils/errores-api';
import { EstadoCargaComponent } from '../../../shared/components/estado-carga/estado-carga.component';
import { sinSoloEspacios } from '../../../shared/validators/validadores';
import { puedeEditar } from '../permisos';
import { nombreUnicoValidator } from './nombre-unico.validator';

/** Estado de un 409: la versión del servidor y qué campos difieren de lo que se estaba editando. */
interface Conflicto {
  servidor: PortafolioDetalle;
  campos: string[];
}

const ETIQUETAS_CAMPO: Readonly<Record<keyof PortafolioPayload, string>> = {
  nombre: 'Nombre',
  descripcion: 'Descripción',
  es_publico: 'Visibilidad',
};

/** Crear (`/portafolios/crear`) y editar (`/portafolios/:id/editar`) con bloqueo optimista. */
@Component({
  selector: 'app-portafolio-form',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EstadoCargaComponent,
  ],
  templateUrl: './portafolio-form.component.html',
  styleUrl: './portafolio-form.component.scss',
})
export class PortafolioFormComponent implements OnInit {
  private readonly service = inject(PortafolioService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  /** Parámetro `:id` de la ruta (ausente al crear). */
  readonly id = input<string>();

  protected readonly portafolioId = computed(() => {
    const id = Number(this.id());
    return Number.isInteger(id) && id > 0 ? id : undefined;
  });
  protected readonly editando = computed(() => this.portafolioId() !== undefined);

  protected readonly limites = {
    nombreMin: NOMBRE_PORTAFOLIO_MIN,
    nombreMax: NOMBRE_PORTAFOLIO_MAX,
    descripcionMax: DESCRIPCION_PORTAFOLIO_MAX,
  };

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: [
      '',
      {
        validators: [
          Validators.required,
          sinSoloEspacios,
          Validators.minLength(NOMBRE_PORTAFOLIO_MIN),
          Validators.maxLength(NOMBRE_PORTAFOLIO_MAX),
        ],
        asyncValidators: [nombreUnicoValidator(this.service, () => this.portafolioId())],
      },
    ],
    descripcion: ['', Validators.maxLength(DESCRIPCION_PORTAFOLIO_MAX)],
    es_publico: [false],
  });

  protected readonly longitudDescripcion = toSignal(this.form.controls.descripcion.valueChanges, {
    initialValue: '',
  });

  protected readonly cargando = signal(false);
  protected readonly errorCarga = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresGenerales = signal<string[]>([]);
  protected readonly conflicto = signal<Conflicto | null>(null);
  /** Versión (`fecha_modificacion`) sobre la que se está editando. */
  private version: FechaHoraIso | null = null;

  ngOnInit(): void {
    const id = this.portafolioId();
    if (id !== undefined) this.cargar(id);
  }

  protected cargar(id: number): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.service.obtener(id).subscribe({
      next: (portafolio) => {
        if (!puedeEditar(this.auth.usuarioActual, portafolio)) {
          this.notificacion.advertencia('Solo el propietario puede editar este portafolio.');
          void this.router.navigate(['/portafolios', id]);
          return;
        }
        this.aplicarVersion(portafolio);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.errorCarga.set(true);
      },
    });
  }

  /** Valida en el cliente (incluida la verificación asíncrona pendiente) antes de enviar. */
  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.pending) {
      this.form.statusChanges
        .pipe(filter((estado) => estado !== 'PENDING'), first())
        .subscribe(() => this.guardar());
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviar();
  }

  /** Descarta los cambios locales y carga la versión vigente del servidor. */
  protected usarVersionServidor(): void {
    const conflicto = this.conflicto();
    if (conflicto) this.aplicarVersion(conflicto.servidor);
    this.conflicto.set(null);
  }

  /** Mantiene los cambios locales y los guarda sobre la nueva versión del servidor. */
  protected sobrescribir(): void {
    const conflicto = this.conflicto();
    if (!conflicto) return;
    this.version = conflicto.servidor.fecha_modificacion;
    this.conflicto.set(null);
    this.guardar();
  }

  protected cancelar(): void {
    const id = this.portafolioId();
    void this.router.navigate(id ? ['/portafolios', id] : ['/portafolios']);
  }

  private enviar(): void {
    const valor = this.form.getRawValue();
    const datos: PortafolioPayload = { ...valor, nombre: valor.nombre.trim() };
    const id = this.portafolioId();
    const solicitud: Observable<Portafolio> =
      id !== undefined && this.version
        ? this.service.actualizar(id, { ...datos, fecha_modificacion: this.version })
        : this.service.crear(datos);

    this.guardando.set(true);
    this.erroresGenerales.set([]);
    solicitud.subscribe({
      next: (portafolio) => {
        this.guardando.set(false);
        this.form.markAsPristine();
        this.notificacion.exito(
          this.editando() ? 'Portafolio actualizado correctamente.' : 'Portafolio creado.',
        );
        void this.router.navigate(['/portafolios', portafolio.id]);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.manejarError(error);
      },
    });
  }

  private manejarError(error: HttpErrorResponse): void {
    const id = this.portafolioId();
    if (error.status === 409 && id !== undefined) {
      this.service.obtener(id).subscribe((servidor) =>
        this.conflicto.set({ servidor, campos: this.camposDistintos(servidor) }),
      );
      return;
    }
    if (error.status === 400) {
      this.erroresGenerales.set(aplicarErroresServidor(this.form, error));
      return;
    }
    this.erroresGenerales.set([extraerMensajeError(error)]);
  }

  private aplicarVersion(portafolio: PortafolioDetalle): void {
    this.version = portafolio.fecha_modificacion;
    this.form.reset({
      nombre: portafolio.nombre,
      descripcion: portafolio.descripcion ?? '',
      es_publico: portafolio.es_publico,
    });
  }

  private camposDistintos(servidor: PortafolioDetalle): string[] {
    const local = this.form.getRawValue();
    return (Object.keys(ETIQUETAS_CAMPO) as (keyof PortafolioPayload)[])
      .filter((campo) => (servidor[campo] ?? '') !== local[campo])
      .map((campo) => ETIQUETAS_CAMPO[campo]);
  }
}
