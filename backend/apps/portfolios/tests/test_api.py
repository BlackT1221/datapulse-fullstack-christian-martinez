"""API de portafolios: permisos por rol, bloqueo optimista (409) y validaciones cruzadas."""
import datetime
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.core.models import LogActividad
from apps.portfolios.models import Portafolio, Posicion

URL = '/api/portafolios/'
HOY = timezone.localdate()
HACE_UN_MES = HOY - datetime.timedelta(days=30)


def url_detalle(portafolio):
    return f'{URL}{portafolio.pk}/'


def url_posiciones(portafolio, posicion=None):
    return f'{URL}{portafolio.pk}/posiciones/' + (f'{posicion.pk}/' if posicion else '')


def crear_posicion(portafolio, pais, tipo='RENTA_FIJA', monto='1000000', salida=None):
    return Posicion.objects.create(
        portafolio=portafolio, pais=pais, tipo_activo=tipo, monto_inversion_usd=Decimal(monto),
        fecha_entrada=HACE_UN_MES, fecha_salida=salida,
    )


def datos_posicion(pais='CO', tipo='RENTA_FIJA', monto='1500000', **extra):
    return {'pais': pais, 'tipo_activo': tipo, 'monto_inversion_usd': monto,
            'fecha_entrada': HACE_UN_MES.isoformat(), **extra}


@pytest.fixture
def portafolio(analista):
    return Portafolio.objects.create(
        usuario=analista, nombre='Andino', descripcion='Renta fija', es_publico=True,
    )


# --- Permisos (SPEC §7, escenario 3) --------------------------------------------------------------

@pytest.mark.django_db
class TestPermisosViewer:
    MENSAJE = 'Los usuarios con rol VIEWER no pueden crear ni editar portafolios.'

    def test_viewer_no_puede_crear_portafolio(self, cliente, viewer):
        respuesta = cliente(viewer).post(URL, {'nombre': 'Mi portafolio'}, format='json')
        assert respuesta.status_code == 403
        assert respuesta.json() == {'error': True, 'codigo': 403, 'mensaje': self.MENSAJE, 'detalles': None}
        assert not Portafolio.objects.exists()

    def test_viewer_no_puede_editar_ni_eliminar(self, cliente, viewer, portafolio):
        api = cliente(viewer)
        datos = {'nombre': 'Cambio', 'fecha_modificacion': portafolio.fecha_modificacion.isoformat()}
        assert api.put(url_detalle(portafolio), datos, format='json').status_code == 403
        assert api.delete(url_detalle(portafolio)).status_code == 403
        portafolio.refresh_from_db()
        assert portafolio.activo and portafolio.nombre == 'Andino'

    def test_viewer_no_puede_gestionar_posiciones(self, cliente, viewer, portafolio, colombia):
        api = cliente(viewer)
        posicion = crear_posicion(portafolio, colombia)
        assert api.post(url_posiciones(portafolio), datos_posicion(), format='json').status_code == 403
        editar = api.put(url_posiciones(portafolio, posicion), datos_posicion(), format='json')
        assert editar.status_code == 403
        assert api.delete(url_posiciones(portafolio, posicion)).status_code == 403

    def test_viewer_puede_consultar_y_exportar_publicos(self, cliente, viewer, portafolio, colombia):
        crear_posicion(portafolio, colombia)
        api = cliente(viewer)
        assert api.get(URL).json()['count'] == 1
        assert api.get(url_detalle(portafolio)).status_code == 200
        assert api.get(f'{url_detalle(portafolio)}export/xlsx/').status_code == 200

    def test_analista_no_puede_editar_portafolio_publico_ajeno(self, cliente, otro_analista, portafolio):
        datos = {'nombre': 'Ajeno', 'fecha_modificacion': portafolio.fecha_modificacion.isoformat()}
        respuesta = cliente(otro_analista).put(url_detalle(portafolio), datos, format='json')
        assert respuesta.status_code == 403
        assert respuesta.json()['mensaje'] == 'Solo el propietario del portafolio puede modificarlo.'

    def test_anonimo_recibe_401(self, api_client, portafolio):
        assert api_client.get(URL).status_code == 401


# --- CRUD, visibilidad y soft delete --------------------------------------------------------------

@pytest.mark.django_db
def test_listado_incluye_propios_y_publicos_pero_no_privados_ajenos(cliente, analista, otro_analista):
    Portafolio.objects.create(usuario=analista, nombre='Propio privado')
    Portafolio.objects.create(usuario=otro_analista, nombre='Ajeno público', es_publico=True)
    privado = Portafolio.objects.create(usuario=otro_analista, nombre='Ajeno privado')
    api = cliente(analista)
    cuerpo = api.get(URL).json()
    assert {p['nombre'] for p in cuerpo['results']} == {'Propio privado', 'Ajeno público'}
    assert {p['nombre']: p['es_propio'] for p in cuerpo['results']} == {
        'Propio privado': True, 'Ajeno público': False,
    }
    assert api.get(url_detalle(privado)).status_code == 404
    assert api.get(URL, {'propios': 'true'}).json()['count'] == 1
    assert api.get(URL, {'search': 'público'}).json()['count'] == 1


@pytest.mark.django_db
def test_crear_portafolio_asigna_usuario_y_audita(cliente, analista):
    respuesta = cliente(analista).post(URL, {'nombre': '  Nuevo  ', 'es_publico': True}, format='json')
    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo['nombre'] == 'Nuevo' and cuerpo['usuario'] == analista.pk and cuerpo['fecha_modificacion']
    assert LogActividad.objects.filter(accion='CREAR', entidad_afectada='Portafolio').exists()


@pytest.mark.django_db
@pytest.mark.parametrize('datos, campo, mensaje', [
    ({'nombre': 'ab'}, 'nombre', 'El nombre debe tener al menos 3 caracteres.'),
    ({'nombre': 'x' * 101}, 'nombre', 'El nombre no puede superar los 100 caracteres.'),
    ({'nombre': 'Válido', 'descripcion': 'x' * 501}, 'descripcion',
     'La descripción no puede superar los 500 caracteres.'),
    ({'nombre': 'andino'}, 'nombre', 'Ya tienes un portafolio con este nombre.'),
])
def test_validaciones_de_portafolio(cliente, analista, portafolio, datos, campo, mensaje):
    respuesta = cliente(analista).post(URL, datos, format='json')
    assert respuesta.status_code == 400
    assert respuesta.json()['detalles'][campo] == [mensaje]


@pytest.mark.django_db
def test_verificar_nombre_para_validacion_asincrona(cliente, analista, portafolio):
    api = cliente(analista)
    assert api.get(f'{URL}verificar-nombre/', {'nombre': 'ANDINO'}).json()['disponible'] is False
    propio = {'nombre': 'Andino', 'excluir': portafolio.pk}
    assert api.get(f'{URL}verificar-nombre/', propio).json()['disponible'] is True
    assert api.get(f'{URL}verificar-nombre/', {'nombre': 'Otro'}).json()['disponible'] is True


@pytest.mark.django_db
def test_eliminar_es_soft_delete(cliente, analista, portafolio):
    api = cliente(analista)
    assert api.delete(url_detalle(portafolio)).status_code == 204
    portafolio.refresh_from_db()
    assert portafolio.activo is False
    assert api.get(url_detalle(portafolio)).status_code == 404
    assert LogActividad.objects.filter(accion='ELIMINAR', entidad_id=str(portafolio.pk)).exists()


# --- Bloqueo optimista (SPEC §7, escenario 5) -----------------------------------------------------

@pytest.mark.django_db
class TestConcurrencia:
    def test_edicion_simultanea_devuelve_409(self, cliente, analista, administrador, portafolio):
        propietario, admin = cliente(analista), cliente(administrador)
        version = propietario.get(url_detalle(portafolio)).json()['fecha_modificacion']
        assert admin.get(url_detalle(portafolio)).json()['fecha_modificacion'] == version

        primera = propietario.put(url_detalle(portafolio), {
            'nombre': 'Andino v2', 'es_publico': True, 'fecha_modificacion': version}, format='json')
        assert primera.status_code == 200
        nueva_version = primera.json()['fecha_modificacion']
        assert nueva_version != version

        segunda = admin.put(url_detalle(portafolio), {
            'nombre': 'Andino admin', 'es_publico': True, 'fecha_modificacion': version}, format='json')
        assert segunda.status_code == 409
        cuerpo = segunda.json()
        assert cuerpo['codigo'] == 409
        assert cuerpo['mensaje'].startswith('El portafolio fue modificado por otro usuario')
        assert cuerpo['detalles']['fecha_modificacion_actual'] == nueva_version
        portafolio.refresh_from_db()
        assert portafolio.nombre == 'Andino v2'

        reintento = admin.put(url_detalle(portafolio), {
            'nombre': 'Andino admin', 'es_publico': True, 'fecha_modificacion': nueva_version}, format='json')
        assert reintento.status_code == 200

    def test_put_sin_fecha_modificacion_es_400(self, cliente, analista, portafolio):
        respuesta = cliente(analista).put(url_detalle(portafolio), {'nombre': 'Andino'}, format='json')
        assert respuesta.status_code == 400
        assert 'fecha_modificacion' in respuesta.json()['detalles']

    def test_agregar_posicion_cambia_la_version(self, cliente, analista, portafolio, colombia):
        api = cliente(analista)
        version = api.get(url_detalle(portafolio)).json()['fecha_modificacion']
        assert api.post(url_posiciones(portafolio), datos_posicion(), format='json').status_code == 201
        respuesta = api.put(url_detalle(portafolio), {'nombre': 'Andino', 'fecha_modificacion': version},
                            format='json')
        assert respuesta.status_code == 409

    def test_patch_no_esta_permitido(self, cliente, analista, portafolio):
        respuesta = cliente(analista).patch(url_detalle(portafolio), {'nombre': 'x'}, format='json')
        assert respuesta.status_code == 405
