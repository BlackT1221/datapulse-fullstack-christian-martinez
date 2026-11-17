from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models
from django.db.models import F, Q

MONTO_MINIMO_POSICION = 1_000
MONTO_MAXIMO_POSICION = 10_000_000


class Portafolio(models.Model):
    nombre = models.CharField('nombre', max_length=100)
    descripcion = models.TextField('descripción', blank=True, validators=[MaxLengthValidator(500)])
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='portafolios',
        verbose_name='usuario',
    )
    fecha_creacion = models.DateTimeField('fecha de creación', auto_now_add=True)
    fecha_modificacion = models.DateTimeField('fecha de modificación', auto_now=True)
    activo = models.BooleanField('activo', default=True)
    es_publico = models.BooleanField('público', default=False)

    class Meta:
        verbose_name = 'portafolio'
        verbose_name_plural = 'portafolios'
        ordering = ['-fecha_modificacion']
        indexes = [
            models.Index(fields=['usuario', 'activo'], name='portafolio_usuario_activo_idx'),
            models.Index(fields=['es_publico', 'activo'], name='portafolio_publico_activo_idx'),
            models.Index(fields=['nombre'], name='portafolio_nombre_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'nombre'],
                name='unique_portafolio_usuario',
                violation_error_message='Ya tienes un portafolio con este nombre.',
            ),
        ]

    def __str__(self):
        return self.nombre

    def clean(self):
        super().clean()
        if self.usuario_id and not self.usuario.puede_editar_portafolios:
            raise ValidationError('Los usuarios con rol VIEWER no pueden crear ni editar portafolios.')


class Posicion(models.Model):
    class TipoActivo(models.TextChoices):
        RENTA_FIJA = 'RENTA_FIJA', 'Renta fija'
        RENTA_VARIABLE = 'RENTA_VARIABLE', 'Renta variable'
        COMMODITIES = 'COMMODITIES', 'Commodities'
        MONEDA = 'MONEDA', 'Moneda'

    portafolio = models.ForeignKey(
        Portafolio, on_delete=models.CASCADE, related_name='posiciones', verbose_name='portafolio'
    )
    pais = models.ForeignKey(
        'countries.Pais', on_delete=models.PROTECT, related_name='posiciones', verbose_name='país'
    )
    tipo_activo = models.CharField('tipo de activo', max_length=15, choices=TipoActivo.choices)
    fecha_entrada = models.DateField('fecha de entrada')
    monto_inversion_usd = models.DecimalField('monto de inversión (USD)', max_digits=14, decimal_places=2)
    fecha_salida = models.DateField('fecha de salida', null=True, blank=True)
    notas = models.CharField('notas', max_length=200, blank=True)

    class Meta:
        verbose_name = 'posición'
        verbose_name_plural = 'posiciones'
        ordering = ['-fecha_entrada']
        indexes = [
            models.Index(fields=['portafolio', 'fecha_salida'], name='posicion_portafolio_activa_idx'),
            models.Index(fields=['pais', 'tipo_activo'], name='posicion_pais_tipo_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(fecha_salida__isnull=True) | Q(fecha_salida__gt=F('fecha_entrada')),
                name='check_fecha_salida_mayor',
                violation_error_message='La fecha de salida debe ser posterior a la fecha de entrada.',
            ),
            models.CheckConstraint(
                condition=Q(monto_inversion_usd__gte=MONTO_MINIMO_POSICION)
                & Q(monto_inversion_usd__lte=MONTO_MAXIMO_POSICION),
                name='posicion_monto_rango',
                violation_error_message='El monto debe estar entre $1,000 y $10,000,000 USD.',
            ),
        ]

    def __str__(self):
        return f'{self.portafolio} · {self.pais_id} · {self.tipo_activo}'

    @property
    def esta_activa(self):
        return self.fecha_salida is None
