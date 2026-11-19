import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { LoadingService } from '../services/loading.service';
import { OMITIR_LOADING } from './contexto-http';

/** Incrementa el contador global de carga mientras la solicitud está en curso. */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(OMITIR_LOADING)) {
    return next(req);
  }
  const loading = inject(LoadingService);
  loading.iniciar();
  return next(req).pipe(finalize(() => loading.finalizar()));
};
