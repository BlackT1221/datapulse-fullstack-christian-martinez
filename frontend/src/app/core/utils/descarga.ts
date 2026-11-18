import { HttpResponse } from '@angular/common/http';

/** Obtiene el nombre de archivo de `Content-Disposition` (requiere que CORS exponga la cabecera). */
export function nombreArchivo(respuesta: HttpResponse<Blob>, porDefecto: string): string {
  const cabecera = respuesta.headers.get('Content-Disposition') ?? '';
  const coincidencia = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cabecera);
  return coincidencia?.[1] ? decodeURIComponent(coincidencia[1]) : porDefecto;
}

/** Dispara la descarga de un `Blob` en el navegador. */
export function guardarArchivo(respuesta: HttpResponse<Blob>, porDefecto: string): void {
  if (!respuesta.body) {
    return;
  }
  const url = URL.createObjectURL(respuesta.body);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo(respuesta, porDefecto);
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
