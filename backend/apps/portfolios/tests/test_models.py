import datetime
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.portfolios.models import Portafolio, Posicion


@pytest.fixture
def portafolio(analista):
    return Portafolio.objects.create(nombre='Andino', usuario=analista)


def _posicion(portafolio, pais, **extra):
    datos = dict(
        portafolio=portafolio, pais=pais, tipo_activo=Posicion.TipoActivo.RENTA_FIJA,
        fecha_entrada=datetime.date(2026, 1, 10), monto_inversion_usd=Decimal('50000'),
    )
    datos.update(extra)
    return Posicion.objects.create(**datos)


def test_nombre_portafolio_duplicado_por_usuario_falla(portafolio, analista):
    with pytest.raises(IntegrityError):
        Portafolio.objects.create(nombre='Andino', usuario=analista)


def test_mismo_nombre_para_otro_usuario_permitido(portafolio, viewer):
    Portafolio.objects.create(nombre='Andino', usuario=viewer)
    assert Portafolio.objects.filter(nombre='Andino').count() == 2


def test_viewer_no_puede_crear_portafolio(viewer):
    portafolio = Portafolio(nombre='Prohibido', usuario=viewer)
    with pytest.raises(ValidationError, match='VIEWER'):
        portafolio.full_clean()


def test_analista_pasa_validacion(analista):
    Portafolio(nombre='Permitido', usuario=analista).full_clean()


def test_fecha_salida_anterior_o_igual_falla(portafolio, colombia):
    with pytest.raises(IntegrityError):
        _posicion(portafolio, colombia, fecha_salida=datetime.date(2026, 1, 10))


def test_fecha_salida_posterior_permitida(portafolio, colombia):
    posicion = _posicion(portafolio, colombia, fecha_salida=datetime.date(2026, 2, 1))
    assert posicion.esta_activa is False


@pytest.mark.parametrize('monto', [Decimal('999.99'), Decimal('10000000.01')])
def test_monto_fuera_de_rango_falla(portafolio, colombia, monto):
    with pytest.raises(IntegrityError):
        _posicion(portafolio, colombia, monto_inversion_usd=monto)
