import { Injectable } from '@angular/core';

import { esRol, Tokens, Usuario } from '../../models';

const CLAVES = {
  access: 'datapulse.access',
  refresh: 'datapulse.refresh',
  usuario: 'datapulse.usuario',
} as const;

function esUsuario(valor: unknown): valor is Usuario {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'id' in valor &&
    typeof valor.id === 'number' &&
    'email' in valor &&
    typeof valor.email === 'string' &&
    'rol' in valor &&
    esRol(valor.rol)
  );
}

/**
 * Persistencia de la sesión en `localStorage`. Todas las operaciones toleran un almacenamiento
 * bloqueado (modo privado, cuotas) sin romper la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  get access(): string | null {
    return this.leer(CLAVES.access);
  }

  get refresh(): string | null {
    return this.leer(CLAVES.refresh);
  }

  leerUsuario(): Usuario | null {
    const crudo = this.leer(CLAVES.usuario);
    if (!crudo) {
      return null;
    }
    try {
      const valor: unknown = JSON.parse(crudo);
      return esUsuario(valor) ? valor : null;
    } catch {
      return null;
    }
  }

  guardarTokens(tokens: Partial<Tokens>): void {
    if (tokens.access) {
      this.escribir(CLAVES.access, tokens.access);
    }
    if (tokens.refresh) {
      this.escribir(CLAVES.refresh, tokens.refresh);
    }
  }

  guardarUsuario(usuario: Usuario): void {
    this.escribir(CLAVES.usuario, JSON.stringify(usuario));
  }

  limpiar(): void {
    for (const clave of Object.values(CLAVES)) {
      try {
        localStorage.removeItem(clave);
      } catch {
        /* almacenamiento no disponible */
      }
    }
  }

  private leer(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }

  private escribir(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      /* almacenamiento no disponible: la sesión vive solo en memoria */
    }
  }
}
