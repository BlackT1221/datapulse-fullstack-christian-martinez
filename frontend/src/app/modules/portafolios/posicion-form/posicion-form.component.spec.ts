import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { Posicion } from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PortafolioService } from '../../../core/services/portafolio.service';
import { DatosPosicionForm, PosicionFormComponent } from './posicion-form.component';
import { COLOMBIA, ECUADOR, posicion } from './posicion.fixtures.spec';

/** Escenario obligatorio 6: un formulario inválido muestra errores sin disparar requests. */
describe('PosicionFormComponent', () => {
  let fixture: ComponentFixture<PosicionFormComponent>;
  let servicio: {
    paisesActuales: typeof COLOMBIA[];
    portafolioActual: { posiciones: Posicion[] };
    agregarPosicion: jasmine.Spy;
    editarPosicion: jasmine.Spy;
  };
  let dialogRef: jasmine.SpyObj<MatDialogRef<PosicionFormComponent, Posicion>>;

  const form = () => (fixture.componentInstance as unknown as { form: FormGroup }).form;
  const enviar = () => {
    const elemento = fixture.nativeElement as HTMLElement;
    elemento.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    return elemento;
  };

  function crear(posiciones: Posicion[] = []): void {
    servicio = {
      paisesActuales: [COLOMBIA, ECUADOR],
      portafolioActual: { posiciones },
      agregarPosicion: jasmine.createSpy('agregarPosicion').and.returnValue(of(posicion('CO', 'RENTA_FIJA', 5_000))),
      editarPosicion: jasmine.createSpy('editarPosicion'),
    };
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [PosicionFormComponent],
      providers: [
        provideNativeDateAdapter(),
        { provide: PortafolioService, useValue: servicio },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { portafolioId: 1 } satisfies DatosPosicionForm },
        { provide: NotificacionService, useValue: jasmine.createSpyObj('NotificacionService', ['exito']) },
      ],
    });
    fixture = TestBed.createComponent(PosicionFormComponent);
    fixture.detectChanges();
  }

  it('un formulario vacío marca los errores y no llama a la API', () => {
    crear();
    enviar();
    expect(form().invalid).toBeTrue();
    expect(form().get('pais')?.touched).toBeTrue();
    expect(servicio.agregarPosicion).not.toHaveBeenCalled();
  });

  it('monto fuera de rango (mín. US$ 1.000) bloquea el envío', () => {
    crear();
    form().patchValue({ pais: COLOMBIA, tipo_activo: 'RENTA_FIJA', monto_inversion_usd: 999 });
    enviar();
    expect(form().get('monto_inversion_usd')?.hasError('min')).toBeTrue();
    expect(servicio.agregarPosicion).not.toHaveBeenCalled();
  });

  it('MONEDA en Ecuador bloquea el envío sin request', () => {
    crear();
    form().patchValue({ pais: ECUADOR, tipo_activo: 'MONEDA', monto_inversion_usd: 5_000 });
    enviar();
    expect(form().hasError('monedaDolarizada')).toBeTrue();
    expect(servicio.agregarPosicion).not.toHaveBeenCalled();
  });

  it('superar US$ 50.000.000 activos bloquea el envío sin request', () => {
    crear([
      posicion('CO', 'RENTA_VARIABLE', 10_000_000),
      posicion('CO', 'COMMODITIES', 10_000_000),
      posicion('EC', 'RENTA_FIJA', 10_000_000),
      posicion('EC', 'COMMODITIES', 10_000_000),
      posicion('EC', 'RENTA_VARIABLE', 9_999_000),
    ]);
    form().patchValue({ pais: COLOMBIA, tipo_activo: 'MONEDA', monto_inversion_usd: 2_000 });
    enviar();
    expect(form().hasError('limiteMonto')).toBeTrue();
    expect(servicio.agregarPosicion).not.toHaveBeenCalled();
  });

  it('una tercera posición activa igual bloquea el envío sin request', () => {
    crear([posicion('CO', 'RENTA_FIJA', 5_000), posicion('CO', 'RENTA_FIJA', 5_000)]);
    form().patchValue({ pais: COLOMBIA, tipo_activo: 'RENTA_FIJA', monto_inversion_usd: 5_000 });
    enviar();
    expect(form().hasError('maxPosicionesIguales')).toBeTrue();
    expect(servicio.agregarPosicion).not.toHaveBeenCalled();
  });

  it('un formulario válido envía la posición y cierra el diálogo', () => {
    crear();
    form().patchValue({
      pais: COLOMBIA,
      tipo_activo: 'RENTA_FIJA',
      monto_inversion_usd: 25_000,
      fecha_entrada: new Date(2026, 0, 15),
    });
    enviar();
    expect(servicio.agregarPosicion).toHaveBeenCalledOnceWith(1, {
      pais: 'CO',
      tipo_activo: 'RENTA_FIJA',
      monto_inversion_usd: '25000.00',
      fecha_entrada: '2026-01-15',
      notas: '',
    });
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
