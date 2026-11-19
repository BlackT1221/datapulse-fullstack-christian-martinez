from django.db import models
from django.db.models import Q


class Pais(models.Model):
    class Region(models.TextChoices):
        ANDINA = 'ANDINA', 'Andina'
        CONO_SUR = 'CONO_SUR', 'Cono Sur'
        CENTROAMERICA = 'CENTROAMERICA', 'Centroamérica'
        CARIBE = 'CARIBE', 'Caribe'

    codigo_iso = models.CharField('código ISO', max_length=2, primary_key=True)
    nombre = models.CharField('nombre', max_length=100)
    moneda_codigo = models.CharField('código de moneda', max_length=3, unique=True)
    moneda_nombre = models.CharField('nombre de moneda', max_length=100)
    region = models.CharField('región', max_length=15, choices=Region.choices)
    latitud = models.DecimalField('latitud', max_digits=9, decimal_places=6)
    longitud = models.DecimalField('longitud', max_digits=9, decimal_places=6)
    poblacion = models.PositiveBigIntegerField('población', null=True, blank=True)
    bandera_url = models.URLField('URL de bandera', blank=True)
    activo = models.BooleanField('activo', default=True)

    class Meta:
        verbose_name = 'país'
        verbose_name_plural = 'países'
        ordering = ['nombre']
        indexes = [
            models.Index(fields=['region'], name='pais_region_idx'),
            models.Index(fields=['activo'], name='pais_activo_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(latitud__gte=-90) & Q(latitud__lte=90),
                name='pais_latitud_rango',
                violation_error_message='La latitud debe estar entre -90 y 90.',
            ),
            models.CheckConstraint(
                condition=Q(longitud__gte=-180) & Q(longitud__lte=180),
                name='pais_longitud_rango',
                violation_error_message='La longitud debe estar entre -180 y 180.',
            ),
        ]

    def __str__(self):
        return f'{self.nombre} ({self.codigo_iso})'


class IndicadorEconomico(models.Model):
    class Tipo(models.TextChoices):
        PIB = 'PIB', 'PIB'
        INFLACION = 'INFLACION', 'Inflación'
        DESEMPLEO = 'DESEMPLEO', 'Desempleo'
        BALANZA_COMERCIAL = 'BALANZA_COMERCIAL', 'Balanza comercial'
        DEUDA_PIB = 'DEUDA_PIB', 'Deuda / PIB'
        PIB_PERCAPITA = 'PIB_PERCAPITA', 'PIB per cápita'

    class Unidad(models.TextChoices):
        PORCENTAJE = 'PORCENTAJE', 'Porcentaje'
        USD = 'USD', 'USD'
        USD_MILES_MILLONES = 'USD_MILES_MILLONES', 'Miles de millones USD'

    class Fuente(models.TextChoices):
        WORLD_BANK = 'WORLD_BANK', 'Banco Mundial'
        MANUAL = 'MANUAL', 'Manual'

    pais = models.ForeignKey(
        Pais, on_delete=models.CASCADE, related_name='indicadores', verbose_name='país'
    )
    tipo = models.CharField('tipo', max_length=20, choices=Tipo.choices)
    valor = models.DecimalField('valor', max_digits=24, decimal_places=4)
    unidad = models.CharField('unidad', max_length=20, choices=Unidad.choices)
    anio = models.PositiveSmallIntegerField('año')
    fuente = models.CharField('fuente', max_length=15, choices=Fuente.choices, default=Fuente.WORLD_BANK)
    fecha_actualizacion = models.DateTimeField('fecha de actualización', auto_now=True)

    class Meta:
        verbose_name = 'indicador económico'
        verbose_name_plural = 'indicadores económicos'
        ordering = ['pais', 'tipo', '-anio']
        indexes = [
            models.Index(fields=['tipo', 'anio'], name='indicador_tipo_anio_idx'),
            models.Index(fields=['anio'], name='indicador_anio_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['pais', 'tipo', 'anio'],
                name='unique_indicador_pais_tipo_anio',
                violation_error_message='Ya existe un indicador de este tipo para el país y año indicados.',
            ),
            models.CheckConstraint(
                condition=Q(anio__gte=1960) & Q(anio__lte=2100),
                name='indicador_anio_rango',
                violation_error_message='El año debe estar entre 1960 y 2100.',
            ),
        ]

    def __str__(self):
        return f'{self.pais_id} · {self.tipo} · {self.anio}: {self.valor}'


class TipoCambio(models.Model):
    moneda_origen = models.ForeignKey(
        Pais,
        on_delete=models.CASCADE,
        to_field='moneda_codigo',
        db_column='moneda_origen',
        related_name='tipos_cambio',
        verbose_name='moneda origen',
    )
    moneda_destino = models.CharField('moneda destino', max_length=3, default='USD')
    tasa = models.DecimalField('tasa', max_digits=20, decimal_places=6)
    fecha = models.DateField('fecha')
    variacion_porcentual = models.DecimalField(
        'variación porcentual', max_digits=10, decimal_places=4, null=True, blank=True,
        help_text='Variación respecto al día anterior.',
    )
    fuente = models.CharField('fuente', max_length=50, default='EXCHANGERATE_API')

    class Meta:
        verbose_name = 'tipo de cambio'
        verbose_name_plural = 'tipos de cambio'
        ordering = ['moneda_origen', '-fecha']
        get_latest_by = 'fecha'
        indexes = [
            models.Index(fields=['moneda_origen', '-fecha'], name='tc_moneda_fecha_idx'),
            models.Index(fields=['fecha'], name='tc_fecha_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['moneda_origen', 'moneda_destino', 'fecha'],
                name='tc_unico_moneda_fecha',
                violation_error_message='Ya existe un tipo de cambio para esta moneda y fecha.',
            ),
            models.CheckConstraint(
                condition=Q(tasa__gt=0),
                name='tc_tasa_positiva',
                violation_error_message='La tasa de cambio debe ser mayor que cero.',
            ),
        ]

    def __str__(self):
        return f'{self.moneda_origen_id}/{self.moneda_destino} {self.fecha}: {self.tasa}'
