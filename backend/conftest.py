"""Fixtures compartidas para los tests de modelos y API."""
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model


@pytest.fixture
def colombia(db):
    from apps.countries.models import Pais

    return Pais.objects.create(
        codigo_iso='CO', nombre='Colombia', moneda_codigo='COP', moneda_nombre='Peso colombiano',
        region=Pais.Region.ANDINA, latitud=Decimal('4.5709'), longitud=Decimal('-74.2973'),
    )


def _crear_pais(codigo, nombre, moneda, region, lat, lon):
    from apps.countries.models import Pais

    return Pais.objects.create(
        codigo_iso=codigo, nombre=nombre, moneda_codigo=moneda, moneda_nombre=moneda, region=region,
        latitud=Decimal(lat), longitud=Decimal(lon),
    )


@pytest.fixture
def brasil(db):
    return _crear_pais('BR', 'Brasil', 'BRL', 'CONO_SUR', '-14.2350', '-51.9253')


@pytest.fixture
def ecuador(db):
    return _crear_pais('EC', 'Ecuador', 'USD', 'ANDINA', '-1.8312', '-78.1834')


@pytest.fixture
def analista(db):
    return get_user_model().objects.create_user(
        email='analista@test.com', password='x', rol='ANALISTA'
    )


@pytest.fixture
def viewer(db):
    return get_user_model().objects.create_user(
        email='viewer@test.com', password='x', rol='VIEWER'
    )


@pytest.fixture
def administrador(db):
    return get_user_model().objects.create_user(
        email='admin@test.com', password='x', rol='ADMIN'
    )


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def cliente():
    """Fábrica de APIClient autenticados: `cliente(usuario)`."""
    from rest_framework.test import APIClient

    def _cliente(usuario):
        api = APIClient()
        api.force_authenticate(usuario)
        return api

    return _cliente


@pytest.fixture
def otro_analista(db):
    return get_user_model().objects.create_user(
        email='otro.analista@test.com', password='x', rol='ANALISTA', nombre_completo='Otro Analista'
    )


@pytest.fixture(autouse=True)
def _limpiar_cache_throttling():
    """El throttling usa la caché: se limpia para que los tests no se bloqueen entre sí."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def datos_seed(db):
    """Carga el seed completo (10 países, IRPC, alertas, 2 portafolios del analista seed)."""
    from django.core.management import call_command

    call_command('seed_data', verbosity=0)
