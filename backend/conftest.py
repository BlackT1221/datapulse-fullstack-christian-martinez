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
