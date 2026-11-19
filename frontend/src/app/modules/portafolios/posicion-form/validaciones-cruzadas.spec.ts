import { FormControl, FormGroup } from '@angular/forms';

import { Pais, Posicion, TipoActivo } from '../../../core/models';
import { COLOMBIA, ECUADOR, posicion } from './posicion.fixtures.spec';
import { ContextoPosiciones, esDolarizado, validacionesCruzadas } from './validaciones-cruzadas';

describe('validacionesCruzadas (PosicionForm)', () => {
  let contexto: ContextoPosiciones;

  function grupo(pais: Pais | string | null, tipo: TipoActivo | null, monto: number | null) {
    return new FormGroup(
      {
        pais: new FormControl<Pais | string | null>(pais),
        tipo_activo: new FormControl<TipoActivo | null>(tipo),
        monto_inversion_usd: new FormControl<number | null>(monto),
      },
      { validators: validacionesCruzadas(() => contexto) },
    );
  }

  beforeEach(() => (contexto = { posiciones: [] }));

  it('acepta una posición válida sin errores cruzados', () => {
    expect(grupo(COLOMBIA, 'RENTA_FIJA', 5_000).errors).toBeNull();
  });

  describe('regla 1: MONEDA en país dolarizado', () => {
    it('rechaza tipo MONEDA para Ecuador (USD)', () => {
      expect(grupo(ECUADOR, 'MONEDA', 5_000).errors).toEqual({
        monedaDolarizada: { pais: 'Ecuador' },
      });
    });

    it('permite MONEDA para un país con moneda propia', () => {
      expect(grupo(COLOMBIA, 'MONEDA', 5_000).errors).toBeNull();
    });

    it('permite otros tipos de activo en Ecuador', () => {
      expect(grupo(ECUADOR, 'RENTA_VARIABLE', 5_000).errors).toBeNull();
    });

    it('ignora el texto libre del autocomplete (aún no es un país)', () => {
      expect(grupo('Ecua', 'MONEDA', 5_000).errors).toBeNull();
    });

    it('esDolarizado tolera null', () => {
      expect(esDolarizado(null)).toBeFalse();
      expect(esDolarizado(ECUADOR)).toBeTrue();
    });
  });

  describe('regla 2: monto activo total ≤ US$ 50.000.000', () => {
    const conActivo = (...montos: number[]): Posicion[] =>
      montos.map((m, i) => posicion(i % 2 ? 'BR' : 'MX', 'COMMODITIES', m));

    it('permite alcanzar exactamente el límite', () => {
      contexto = { posiciones: conActivo(10_000_000, 10_000_000, 10_000_000, 10_000_000, 5_000_000) };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 5_000_000).errors).toBeNull();
    });

    it('rechaza superar el límite e informa el disponible', () => {
      contexto = { posiciones: conActivo(10_000_000, 10_000_000, 10_000_000, 10_000_000, 9_500_000) };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 1_000_000).errors).toEqual({
        limiteMonto: { activoActual: 49_500_000, disponible: 500_000, limite: 50_000_000 },
      });
    });

    it('no cuenta las posiciones cerradas', () => {
      contexto = {
        posiciones: [
          ...conActivo(10_000_000, 10_000_000, 10_000_000, 10_000_000),
          posicion('PE', 'RENTA_FIJA', 10_000_000, { fecha_salida: '2026-05-01', esta_activa: false }),
        ],
      };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 10_000_000).errors).toBeNull();
    });

    it('al editar excluye el monto anterior de la propia posición', () => {
      const editada = posicion('CO', 'RENTA_FIJA', 10_000_000);
      contexto = {
        posiciones: [...conActivo(10_000_000, 10_000_000, 10_000_000, 10_000_000), editada],
        editandoId: editada.id,
      };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 10_000_000).errors).toBeNull();
    });
  });

  describe('regla 3: máximo 2 posiciones activas mismo país + tipo', () => {
    it('permite la segunda posición igual', () => {
      contexto = { posiciones: [posicion('CO', 'RENTA_FIJA', 5_000)] };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 5_000).errors).toBeNull();
    });

    it('rechaza la tercera posición igual', () => {
      contexto = {
        posiciones: [posicion('CO', 'RENTA_FIJA', 5_000), posicion('CO', 'RENTA_FIJA', 5_000)],
      };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 5_000).errors).toEqual({
        maxPosicionesIguales: { pais: 'Colombia', tipo: 'Renta fija', maximo: 2 },
      });
    });

    it('no cuenta posiciones cerradas, de otro tipo o de otro país', () => {
      contexto = {
        posiciones: [
          posicion('CO', 'RENTA_FIJA', 5_000),
          posicion('CO', 'RENTA_FIJA', 5_000, { fecha_salida: '2026-03-01', esta_activa: false }),
          posicion('CO', 'RENTA_VARIABLE', 5_000),
          posicion('BR', 'RENTA_FIJA', 5_000),
        ],
      };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 5_000).errors).toBeNull();
    });

    it('al editar una de las dos existentes no se cuenta a sí misma', () => {
      const a = posicion('CO', 'RENTA_FIJA', 5_000);
      contexto = { posiciones: [a, posicion('CO', 'RENTA_FIJA', 5_000)], editandoId: a.id };
      expect(grupo(COLOMBIA, 'RENTA_FIJA', 5_000).errors).toBeNull();
    });
  });

  it('acumula varias reglas incumplidas a la vez', () => {
    contexto = {
      posiciones: [
        posicion('EC', 'MONEDA', 10_000_000),
        posicion('EC', 'MONEDA', 10_000_000),
        posicion('BR', 'RENTA_FIJA', 10_000_000),
        posicion('BR', 'COMMODITIES', 10_000_000),
        posicion('MX', 'RENTA_FIJA', 10_000_000),
      ],
    };
    const errores = grupo(ECUADOR, 'MONEDA', 1_000).errors ?? {};
    expect(Object.keys(errores).sort()).toEqual([
      'limiteMonto',
      'maxPosicionesIguales',
      'monedaDolarizada',
    ]);
  });
});
