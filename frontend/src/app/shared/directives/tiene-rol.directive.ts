import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/services/auth.service';
import { Rol } from '../../core/models';

/**
 * Renderiza el contenido solo si el usuario tiene alguno de los roles indicados.
 * Uso: `<button *appTieneRol="['ADMIN', 'ANALISTA']">Crear</button>`
 */
@Directive({ selector: '[appTieneRol]' })
export class TieneRolDirective {
  private readonly plantilla = inject(TemplateRef<unknown>);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly usuario = toSignal(inject(AuthService).usuario$, { initialValue: null });
  private visible = false;

  readonly appTieneRol = input.required<readonly Rol[]>();

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      const permitido = usuario !== null && this.appTieneRol().includes(usuario.rol);
      if (permitido && !this.visible) {
        this.contenedor.createEmbeddedView(this.plantilla);
      } else if (!permitido && this.visible) {
        this.contenedor.clear();
      }
      this.visible = permitido;
    });
  }
}
