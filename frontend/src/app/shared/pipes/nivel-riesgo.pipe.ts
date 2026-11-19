import { Pipe, PipeTransform } from '@angular/core';

import { NivelRiesgo, NIVELES_RIESGO } from '../../core/models';
import { SIN_DATO } from './numero';

type AtributoNivel = 'etiqueta' | 'color' | 'accion';

/** `'MODERADO' | nivelRiesgo` → `Moderado`; `| nivelRiesgo:'color'` → `#eab308`. */
@Pipe({ name: 'nivelRiesgo' })
export class NivelRiesgoPipe implements PipeTransform {
  transform(nivel: NivelRiesgo | null | undefined, atributo: AtributoNivel = 'etiqueta'): string {
    return nivel ? NIVELES_RIESGO[nivel][atributo] : SIN_DATO;
  }
}
