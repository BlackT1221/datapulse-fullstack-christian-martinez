import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/auth/services/auth.service';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { extraerMensajeError } from '../../../core/utils/errores-api';
import { emailValido } from '../../../shared/validators/validadores';
import { destinoSeguro } from '../redireccion';

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos, o la cuenta está inactiva.';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: '../auth-form.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacion = inject(NotificacionService);
  private readonly parametros = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly ocultarPassword = signal(true);
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly sesionExpirada = this.parametros.get('sesion') === 'expirada';

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, emailValido, Validators.maxLength(254)]],
    password: ['', [Validators.required]],
  });

  protected enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth
      .login({ email: email.trim().toLowerCase(), password })
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (usuario) => {
          this.notificacion.exito(`¡Bienvenido, ${usuario.nombre_completo}!`);
          void this.router.navigateByUrl(destinoSeguro(this.parametros.get('returnUrl')));
        },
        error: (error: unknown) => this.errorServidor.set(this.mensaje(error)),
      });
  }

  private mensaje(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un error inesperado. Inténtalo nuevamente.';
    }
    return error.status === 401 ? MENSAJE_CREDENCIALES : extraerMensajeError(error);
  }
}
