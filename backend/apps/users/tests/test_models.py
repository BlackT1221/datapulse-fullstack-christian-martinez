import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_crear_usuario_con_email_como_identificador():
    usuario = get_user_model().objects.create_user(
        email='analista@datapulse.com', password='ClaveSegura123!', rol='ANALISTA'
    )
    assert usuario.get_username() == 'analista@datapulse.com'
    assert usuario.check_password('ClaveSegura123!')
    assert usuario.activo is True


@pytest.mark.django_db
def test_superusuario_tiene_rol_admin():
    admin = get_user_model().objects.create_superuser(email='admin@datapulse.com', password='x')
    assert admin.rol == 'ADMIN'
    assert admin.is_staff and admin.is_superuser
