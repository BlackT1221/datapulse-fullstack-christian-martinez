/**
 * Build de producción para Vercel/Netlify (`npm run build`): la SPA llama directamente a la API
 * pública en Render. Si Render asigna otra URL al servicio `datapulse-backend`, cámbiala aquí.
 * La imagen Docker (docker-compose) usa `environment.ts` (`/api` vía proxy nginx).
 */
export const environment = {
  production: true,
  apiUrl: 'https://datapulse-backend-11qv.onrender.com/api',
};
