import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/auth/services/auth.service';
import { ETIQUETAS_ROL, RolAutoregistro } from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { aplicarErroresServidor, extraerMensajeError } from '../../../core/utils/errores-api';
import {
  emailValido,
  igualA,
  noSoloNumeros,
  sinSoloEspacios,
} from '../../../shared/validators/validadores';

interface OpcionRol {
  valor: RolAutoregistro;
  etiqueta: string;
  descripcion: string;
}

export const LONGITUD_MINIMA_PASSWORD = 8;

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: '../auth-form.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacion = inject(NotificacionService);

  protected readonly minimoPassword = LONGITUD_MINIMA_PASSWORD;
  protected readonly ocultarPassword = signal(true);
  protected readonly enviando = signal(false);
  protected readonly erroresGenerales = signal<string[]>([]);

  protected readonly roles: readonly OpcionRol[] = [
    {
      valor: 'ANALISTA',
      etiqueta: ETIQUETAS_ROL.ANALISTA,
      descripcion: 'Crea y gestiona portafolios',
    },
    {
      valor: 'VIEWER',
      etiqueta: ETIQUETAS_ROL.VIEWER,
      descripcion: 'Solo consulta de información',
    },
  ];

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre_completo: [
      '',
      [Validators.required, sinSoloEspacios, Validators.minLength(3), Validators.maxLength(150)],
    ],
    email: ['', [Validators.required, emailValido, Validators.maxLength(254)]],
    rol: ['VIEWER' as RolAutoregistro, [Validators.required]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(LONGITUD_MINIMA_PASSWORD),
        Validators.maxLength(128),
        noSoloNumeros,
      ],
    ],
    password_confirmacion: ['', [Validators.required, igualA('password')]],
  });

  constructor() {
    // Revalida la confirmación cuando cambia la contraseña original.
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.password_confirmacion.updateValueAndValidity());
  }

  protected enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.erroresGenerales.set([]);
    const datos = this.form.getRawValue();

    this.auth
      .registrar({
        ...datos,
        email: datos.email.trim().toLowerCase(),
        nombre_completo: datos.nombre_completo.trim(),
      })
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (usuario) => {
          this.notificacion.exito(
            `Cuenta creada correctamente. ¡Bienvenido, ${usuario.nombre_completo}!`,
          );
          void this.router.navigate(['/dashboard']);
        },
        error: (error: unknown) => this.manejarError(error),
      });
  }

  private manejarError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.erroresGenerales.set(['Ocurrió un error inesperado. Inténtalo nuevamente.']);
      return;
    }
    const generales = error.status === 400 ? aplicarErroresServidor(this.form, error) : [];
    const hayErroresDeCampo = error.status === 400 && generales.length === 0;
    this.erroresGenerales.set(
      hayErroresDeCampo ? [] : generales.length ? generales : [extraerMensajeError(error)],
    );
  }
}
