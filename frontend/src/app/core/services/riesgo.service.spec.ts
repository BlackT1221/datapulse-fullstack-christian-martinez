import { HttpContext, HttpContextToken, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Paginado, RankingRiesgo, ResultadoRecalculo } from '../models';
import { ApiService } from './api.service';
import { RiesgoService } from './riesgo.service';

describe('RiesgoService', () => {
  let service: RiesgoService;
  let http: HttpTestingController;
  let url: (ruta: string) => string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RiesgoService);
    http = TestBed.inject(HttpTestingController);
    const api = TestBed.inject(ApiService);
    url = (ruta) => api.url(ruta);
  });

  afterEach(() => http.verify());

  it('ranking consulta /api/riesgo/ omitiendo filtros vacíos', () => {
    const respuesta: Paginado<RankingRiesgo> = { count: 0, next: null, previous: null, results: [] };
    let recibido: Paginado<RankingRiesgo> | undefined;

    service
      .ranking({ nivel_riesgo: 'ALTO', region: undefined, search: '' })
      .subscribe((r) => (recibido = r));

    const req = http.expectOne((r) => r.url === url('riesgo/'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('nivel_riesgo')).toBe('ALTO');
    expect(req.request.params.has('region')).toBeFalse();
    expect(req.request.params.has('search')).toBeFalse();
    req.flush(respuesta);
    expect(recibido).toEqual(respuesta);
  });

  it('detalle normaliza el código ISO y propaga el HttpContext', () => {
    const MARCA = new HttpContextToken<boolean>(() => false);
    service.detalle(' co ', new HttpContext().set(MARCA, true)).subscribe();

    const req = http.expectOne(url('riesgo/CO/'));
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(MARCA)).toBeTrue();
    req.flush({});
  });

  it('historico envía el rango de fechas como query params', () => {
    service.historico('br', { fecha_desde: '2026-01-01', fecha_hasta: '2026-06-30' }).subscribe();

    const req = http.expectOne((r) => r.url === url('riesgo/BR/historico/'));
    expect(req.request.params.get('fecha_desde')).toBe('2026-01-01');
    expect(req.request.params.get('fecha_hasta')).toBe('2026-06-30');
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('historico codifica caracteres especiales del código', () => {
    service.historico('a/b').subscribe();
    const req = http.expectOne((r) => r.url === url('riesgo/A%2FB/historico/'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('recalcular hace POST a /api/riesgo/calcular/ sin cuerpo', () => {
    const respuesta: ResultadoRecalculo = { calculados: 10, errores: [], ranking: [] };
    let recibido: ResultadoRecalculo | undefined;
    service.recalcular().subscribe((r) => (recibido = r));

    const req = http.expectOne(url('riesgo/calcular/'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(respuesta);
    expect(recibido?.calculados).toBe(10);
  });
});
