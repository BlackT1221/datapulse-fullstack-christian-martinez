from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.risk.models import Alerta, IndiceRiesgo


def _indice(pais, **extra):
    datos = dict(
        pais=pais, score_economico=Decimal('45'), score_cambiario=Decimal('90'),
        score_estabilidad=Decimal('80'), indice_compuesto=Decimal('69'),
        nivel_riesgo=IndiceRiesgo.Nivel.MODERADO,
    )
    datos.update(extra)
    return IndiceRiesgo.objects.create(**datos)


def test_indice_valido_se_guarda(colombia):
    indice = _indice(colombia, detalle_calculo={'indicadores_faltantes': []})
    assert colombia.indices_riesgo.latest() == indice


@pytest.mark.parametrize('valor', [Decimal('-1'), Decimal('100.01')])
def test_indice_compuesto_fuera_de_rango_falla(colombia, valor):
    with pytest.raises(IntegrityError):
        _indice(colombia, indice_compuesto=valor)


def test_sub_score_fuera_de_rango_falla(colombia):
    with pytest.raises(IntegrityError):
        _indice(colombia, score_cambiario=Decimal('101'))


def test_alerta_global_sin_usuario(colombia):
    alerta = Alerta.objects.create(
        pais=colombia, tipo_alerta=Alerta.TipoAlerta.RIESGO, severidad=Alerta.Severidad.CRITICAL,
        titulo='Riesgo crítico', mensaje='IRPC < 25',
    )
    assert alerta.usuario is None
    assert alerta.leida is False
