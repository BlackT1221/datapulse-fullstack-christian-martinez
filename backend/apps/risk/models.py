from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

SCORE_FIELDS = ('score_economico', 'score_cambiario', 'score_estabilidad', 'indice_compuesto')


def _score_field(verbose_name):
    return models.DecimalField(verbose_name, max_digits=5, decimal_places=2)


CONSTRAINT_NAMES = {'indice_compuesto': 'check_irpc_rango'}


def _rango_score_constraint(campo):
    return models.CheckConstraint(
        condition=Q(**{f'{campo}__gte': 0}) & Q(**{f'{campo}__lte': 100}),
        name=CONSTRAINT_NAMES.get(campo, f'check_{campo}_rango'),
        violation_error_message=f'El campo {campo} debe estar entre 0 y 100.',
    )


class IndiceRiesgo(models.Model):
    class Nivel(models.TextChoices):
        BAJO = 'BAJO', 'Bajo'
        MODERADO = 'MODERADO', 'Moderado'
        ALTO = 'ALTO', 'Alto'
        CRITICO = 'CRITICO', 'Crítico'

    pais = models.ForeignKey(
        'countries.Pais', on_delete=models.CASCADE, related_name='indices_riesgo', verbose_name='país'
    )
    fecha_calculo = models.DateTimeField('fecha de cálculo', default=timezone.now)
    score_economico = _score_field('score económico')
    score_cambiario = _score_field('score cambiario')
    score_estabilidad = _score_field('score de estabilidad')
    indice_compuesto = _score_field('índice compuesto (IRPC)')
    nivel_riesgo = models.CharField('nivel de riesgo', max_length=10, choices=Nivel.choices)
    detalle_calculo = models.JSONField('detalle del cálculo', default=dict, blank=True)

    class Meta:
        verbose_name = 'índice de riesgo'
        verbose_name_plural = 'índices de riesgo'
        ordering = ['-fecha_calculo']
        get_latest_by = 'fecha_calculo'
        indexes = [
            models.Index(fields=['pais', '-fecha_calculo'], name='riesgo_pais_fecha_idx'),
            models.Index(fields=['nivel_riesgo'], name='riesgo_nivel_idx'),
        ]
        constraints = [_rango_score_constraint(campo) for campo in SCORE_FIELDS]

    def __str__(self):
        return f'{self.pais_id} · IRPC {self.indice_compuesto} ({self.nivel_riesgo})'


class Alerta(models.Model):
    class TipoAlerta(models.TextChoices):
        RIESGO = 'RIESGO', 'Riesgo'
        TIPO_CAMBIO = 'TIPO_CAMBIO', 'Tipo de cambio'
        INDICADOR = 'INDICADOR', 'Indicador'

    class Severidad(models.TextChoices):
        INFO = 'INFO', 'Información'
        WARNING = 'WARNING', 'Advertencia'
        CRITICAL = 'CRITICAL', 'Crítica'

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='alertas',
        verbose_name='usuario',
        help_text='Vacío para alertas globales.',
    )
    pais = models.ForeignKey(
        'countries.Pais', on_delete=models.CASCADE, related_name='alertas', verbose_name='país'
    )
    tipo_alerta = models.CharField('tipo de alerta', max_length=15, choices=TipoAlerta.choices)
    severidad = models.CharField('severidad', max_length=10, choices=Severidad.choices)
    titulo = models.CharField('título', max_length=200)
    mensaje = models.TextField('mensaje')
    leida = models.BooleanField('leída', default=False)
    fecha_creacion = models.DateTimeField('fecha de creación', auto_now_add=True)

    class Meta:
        verbose_name = 'alerta'
        verbose_name_plural = 'alertas'
        ordering = ['-fecha_creacion']
        indexes = [
            models.Index(fields=['usuario', 'leida'], name='alerta_usuario_leida_idx'),
            models.Index(fields=['tipo_alerta', 'severidad'], name='alerta_tipo_severidad_idx'),
            models.Index(fields=['-fecha_creacion'], name='alerta_fecha_idx'),
            models.Index(fields=['severidad'], name='alerta_severidad_idx'),
            models.Index(fields=['leida'], name='alerta_leida_idx'),
        ]

    def __str__(self):
        return f'[{self.severidad}] {self.titulo}'
