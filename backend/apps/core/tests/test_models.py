from apps.core.models import LogActividad


def test_log_conserva_registro_al_eliminar_usuario(analista):
    log = LogActividad.objects.create(
        usuario=analista, accion=LogActividad.Accion.LOGIN, entidad_afectada='Usuario',
        entidad_id=str(analista.pk), ip_address='127.0.0.1', detalle={'exito': True},
    )
    analista.delete()
    log.refresh_from_db()
    assert log.usuario is None
    assert log.detalle == {'exito': True}
