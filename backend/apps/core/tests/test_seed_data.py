from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db.models import Sum

from apps.countries.models import IndicadorEconomico, Pais, TipoCambio
from apps.portfolios.models import Portafolio, Posicion


def _conteos():
    return (
        Pais.objects.count(), get_user_model().objects.count(), IndicadorEconomico.objects.count(),
        TipoCambio.objects.count(), Portafolio.objects.count(), Posicion.objects.count(),
    )


@pytest.mark.django_db
def test_seed_es_idempotente():
    call_command('seed_data', verbosity=0)
    primera = _conteos()
    call_command('seed_data', verbosity=0)
    assert _conteos() == primera == (10, 3, 10 * 6 * 3, 10 * 30, 2, 8)


@pytest.mark.django_db
def test_seed_usuarios_con_roles_y_password():
    call_command('seed_data', verbosity=0)
    for email, rol in [
        ('admin@datapulse.com', 'ADMIN'),
        ('analista@datapulse.com', 'ANALISTA'),
        ('viewer@datapulse.com', 'VIEWER'),
    ]:
        usuario = get_user_model().objects.get(email=email)
        assert usuario.rol == rol
        assert usuario.check_password('DataPulse2026!')
    assert get_user_model().objects.get(email='admin@datapulse.com').is_superuser


@pytest.mark.django_db
def test_seed_colombia_reproduce_caso_de_referencia():
    call_command('seed_data', verbosity=0)
    co = {i.tipo: i.valor for i in IndicadorEconomico.objects.filter(pais_id='CO', anio=2023)}
    assert co['PIB_PERCAPITA'] == Decimal('6800')
    assert co['INFLACION'] == Decimal('9.2')
    assert co['DESEMPLEO'] == Decimal('11.3')
    assert co['DEUDA_PIB'] == Decimal('55')
    assert co['BALANZA_COMERCIAL'] == Decimal('-4.2')


@pytest.mark.django_db
def test_seed_respeta_validaciones_de_negocio():
    call_command('seed_data', verbosity=0)
    assert not Posicion.objects.filter(tipo_activo='MONEDA', pais__moneda_codigo='USD').exists()
    for portafolio in Portafolio.objects.all():
        activas = portafolio.posiciones.filter(fecha_salida__isnull=True)
        activo = activas.aggregate(t=Sum('monto_inversion_usd'))['t']
        assert activo <= 50_000_000
    assert TipoCambio.objects.filter(moneda_origen_id='COP').count() == 30
