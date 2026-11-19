import pytest
from django.urls import reverse

from apps.core.models import LogActividad
from apps.users.models import Usuario

CLAVE = 'ClaveMuySegura#2026'


def _registro(api_client, **extra):
    datos = {
        'email': 'nuevo@test.com', 'nombre_completo': 'Usuario Nuevo',
        'password': CLAVE, 'password_confirmacion': CLAVE,
    }
    datos.update(extra)
    return api_client.post(reverse('auth-register'), datos, format='json')


@pytest.mark.django_db
class TestRegistro:
    def test_registro_exitoso_devuelve_tokens(self, api_client):
        respuesta = _registro(api_client, rol='ANALISTA')
        assert respuesta.status_code == 201
        cuerpo = respuesta.json()
        assert {'access', 'refresh', 'usuario'} <= cuerpo.keys()
        assert cuerpo['usuario']['rol'] == 'ANALISTA'
        assert LogActividad.objects.filter(accion='CREAR', entidad_afectada='Usuario').exists()

    def test_rol_por_defecto_es_viewer(self, api_client):
        assert _registro(api_client).json()['usuario']['rol'] == 'VIEWER'

    def test_no_permite_autoregistrarse_como_admin(self, api_client):
        respuesta = _registro(api_client, rol='ADMIN')
        assert respuesta.status_code == 400
        assert 'ANALISTA o VIEWER' in respuesta.json()['detalles']['rol'][0]

    def test_email_duplicado(self, api_client, analista):
        respuesta = _registro(api_client, email='ANALISTA@test.com')
        assert respuesta.status_code == 400
        assert respuesta.json()['detalles']['email'] == [
            'Ya existe un usuario registrado con este correo electrónico.'
        ]

    def test_passwords_no_coinciden(self, api_client):
        respuesta = _registro(api_client, password_confirmacion='otra-clave-123')
        assert respuesta.json()['detalles']['password_confirmacion'] == ['Las contraseñas no coinciden.']

    def test_password_debil(self, api_client):
        respuesta = _registro(api_client, password='123', password_confirmacion='123')
        assert respuesta.status_code == 400
        assert 'password' in respuesta.json()['detalles']


@pytest.mark.django_db
class TestLoginYPerfil:
    def _login(self, api_client, email='analista@test.com', password='x'):
        datos = {'email': email, 'password': password}
        return api_client.post(reverse('token_obtain_pair'), datos, format='json')

    def test_login_devuelve_tokens_y_registra_actividad(self, api_client, analista):
        respuesta = self._login(api_client, password='x')
        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo['usuario']['email'] == 'analista@test.com'
        assert {'access', 'refresh'} <= cuerpo.keys()
        log = LogActividad.objects.get(accion='LOGIN')
        assert log.usuario == analista and log.ip_address == '127.0.0.1'

    def test_login_credenciales_invalidas(self, api_client, analista):
        respuesta = self._login(api_client, password='mala')
        assert respuesta.status_code == 401
        assert respuesta.json()['mensaje'] == 'Credenciales inválidas o cuenta inactiva.'

    def test_login_usuario_inactivo(self, api_client, analista):
        analista.activo = False
        analista.save()
        assert analista.is_active is False
        assert self._login(api_client).status_code == 401

    def test_refresh_token(self, api_client, analista):
        refresh = self._login(api_client).json()['refresh']
        respuesta = api_client.post(reverse('token_refresh'), {'refresh': refresh}, format='json')
        assert respuesta.status_code == 200
        assert 'access' in respuesta.json()

    def test_me_requiere_autenticacion(self, api_client):
        respuesta = api_client.get(reverse('auth-me'))
        assert respuesta.status_code == 401
        assert respuesta.json()['error'] is True

    def test_me_get_y_put(self, api_client, analista):
        access = self._login(api_client).json()['access']
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        assert api_client.get(reverse('auth-me')).json()['email'] == 'analista@test.com'

        respuesta = api_client.put(
            reverse('auth-me'), {'nombre_completo': 'Ana Analista', 'rol': 'ADMIN'}, format='json'
        )
        assert respuesta.status_code == 200
        analista.refresh_from_db()
        assert analista.nombre_completo == 'Ana Analista'
        assert analista.rol == Usuario.Rol.ANALISTA  # el rol no es editable por el propio usuario
        assert LogActividad.objects.filter(accion='EDITAR', usuario=analista).exists()
