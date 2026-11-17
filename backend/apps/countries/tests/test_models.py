import datetime
from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.countries.models import IndicadorEconomico, Pais, TipoCambio


def _indicador(pais, **extra):
    datos = dict(
        pais=pais, tipo=IndicadorEconomico.Tipo.INFLACION, valor=Decimal('9.2'),
        unidad=IndicadorEconomico.Unidad.PORCENTAJE, anio=2023,
    )
    datos.update(extra)
    return IndicadorEconomico.objects.create(**datos)


def test_indicador_duplicado_pais_tipo_anio_falla(colombia):
    _indicador(colombia)
    with pytest.raises(IntegrityError):
        _indicador(colombia, valor=Decimal('10'))


def test_indicador_mismo_tipo_otro_anio_permitido(colombia):
    _indicador(colombia)
    _indicador(colombia, anio=2022)
    assert colombia.indicadores.count() == 2


def test_tipo_cambio_enlaza_por_moneda_codigo(colombia):
    tc = TipoCambio.objects.create(
        moneda_origen=colombia, tasa=Decimal('4000'), fecha=datetime.date(2026, 11, 1)
    )
    assert tc.moneda_origen_id == 'COP'
    assert tc.moneda_destino == 'USD'
    assert list(colombia.tipos_cambio.all()) == [tc]


def test_tipo_cambio_tasa_no_positiva_falla(colombia):
    with pytest.raises(IntegrityError):
        TipoCambio.objects.create(moneda_origen=colombia, tasa=0, fecha=datetime.date(2026, 11, 1))


def test_tipo_cambio_duplicado_misma_fecha_falla(colombia):
    fecha = datetime.date(2026, 11, 1)
    TipoCambio.objects.create(moneda_origen=colombia, tasa=Decimal('4000'), fecha=fecha)
    with pytest.raises(IntegrityError):
        TipoCambio.objects.create(moneda_origen=colombia, tasa=Decimal('4010'), fecha=fecha)


def test_moneda_codigo_unica(colombia):
    with pytest.raises(IntegrityError):
        Pais.objects.create(
            codigo_iso='XX', nombre='Duplicado', moneda_codigo='COP', moneda_nombre='Peso',
            region=Pais.Region.ANDINA, latitud=0, longitud=0,
        )
