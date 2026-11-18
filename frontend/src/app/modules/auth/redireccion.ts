const DESTINO_POR_DEFECTO = '/dashboard';

/** Evita open redirects: solo rutas internas absolutas que no sean de autenticación. */
export function destinoSeguro(returnUrl: string | null): string {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return DESTINO_POR_DEFECTO;
  }
  return returnUrl.startsWith('/auth') ? DESTINO_POR_DEFECTO : returnUrl;
}
