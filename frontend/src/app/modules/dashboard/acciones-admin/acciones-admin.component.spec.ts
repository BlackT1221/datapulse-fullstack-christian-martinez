import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ResultadoRecalculo, ResultadoSincronizacion } from '../../../core/models';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PaisService } from '../../../core/services/pais.service';
import { RiesgoService } from '../../../core/services/riesgo.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { AccionesAdminComponent } from './acciones-admin.component';

const SYNC: ResultadoSincronizacion = {
  indicadores: { procesados: 60, actualizados: 12, errores: [] },
  tipos_cambio: { procesados: 10, actualizados: 10, errores: [{ contexto: 'AR', mensaje: 'timeout' }] },
  irpc: { calculados: 10, errores: [] },
};
const RECALCULO: ResultadoRecalculo = { calculados: 10, errores: [], ranking: [] };

describe('AccionesAdminComponent', () => {
  let confirmar: jasmine.Spy;
  let pais: jasmine.SpyObj<PaisService>;
  let riesgo: jasmine.SpyObj<RiesgoService>;
  let notificacion: jasmine.SpyObj<NotificacionService>;

  function crear() {
    const fixture = TestBed.createComponent(AccionesAdminComponent);
    fixture.detectChanges();
    const completado = jasmine.createSpy('completado');
    fixture.componentInstance.completado.subscribe(completado);
    const botones = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    return { botones, completado };
  }

  beforeEach(() => {
    confirmar = jasmine.createSpy('confirmar').and.returnValue(of(true));
    pais = jasmine.createSpyObj('PaisService', ['sincronizarIndicadores']);
    riesgo = jasmine.createSpyObj('RiesgoService', ['recalcular']);
    notificacion = jasmine.createSpyObj('NotificacionService', ['exito', 'advertencia']);
    pais.sincronizarIndicadores.and.returnValue(of(SYNC));
    riesgo.recalcular.and.returnValue(of(RECALCULO));

    TestBed.configureTestingModule({
      imports: [AccionesAdminComponent],
      providers: [
        { provide: ConfirmDialogService, useValue: { confirmar } },
        { provide: PaisService, useValue: pais },
        { provide: RiesgoService, useValue: riesgo },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
  });

  it('recalcula tras confirmar, notifica éxito y emite completado', () => {
    const { botones, completado } = crear();
    botones[0].click();
    expect(riesgo.recalcular).toHaveBeenCalled();
    expect(notificacion.exito).toHaveBeenCalledWith('Recálculo completado: 10 países actualizados.');
    expect(completado).toHaveBeenCalled();
  });

  it('sincroniza y advierte cuando hubo errores parciales', () => {
    const { botones, completado } = crear();
    botones[1].click();
    expect(pais.sincronizarIndicadores).toHaveBeenCalled();
    expect(notificacion.advertencia.calls.mostRecent().args[0]).toContain('1 errores parciales');
    expect(completado).toHaveBeenCalled();
  });

  it('no ejecuta nada si el usuario cancela', () => {
    confirmar.and.returnValue(of(false));
    const { botones, completado } = crear();
    botones[1].click();
    expect(pais.sincronizarIndicadores).not.toHaveBeenCalled();
    expect(completado).not.toHaveBeenCalled();
  });
});
