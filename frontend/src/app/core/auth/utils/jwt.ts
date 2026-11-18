import { PayloadJwt } from '../../models';

function decodificarBase64Url(segmento: string): string {
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binario = atob(relleno);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function esPayloadJwt(valor: unknown): valor is PayloadJwt {
  return (
    typeof valor === 'object' && valor !== null && 'exp' in valor && typeof valor.exp === 'number'
  );
}

/** Decodifica (sin verificar la firma) el payload de un JWT. */
export function decodificarJwt(token: string): PayloadJwt | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(decodificarBase64Url(partes[1]));
    return esPayloadJwt(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** `true` si el token no es decodificable o expira dentro de `margenSegundos`. */
export function tokenExpirado(token: string | null, margenSegundos = 10): boolean {
  const payload = token ? decodificarJwt(token) : null;
  return payload === null || payload.exp * 1000 <= Date.now() + margenSegundos * 1000;
}
