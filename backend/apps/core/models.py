from django.conf import settings
from django.db import models


class LogActividad(models.Model):
    class Accion(models.TextChoices):
        CREAR = 'CREAR', 'Crear'
        EDITAR = 'EDITAR', 'Editar'
        ELIMINAR = 'ELIMINAR', 'Eliminar'
        CONSULTAR = 'CONSULTAR', 'Consultar'
        LOGIN = 'LOGIN', 'Inicio de sesión'
        EXPORT = 'EXPORT', 'Exportar'

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs_actividad',
        verbose_name='usuario',
    )
    accion = models.CharField('acción', max_length=10, choices=Accion.choices)
    entidad_afectada = models.CharField('entidad afectada', max_length=50)
    entidad_id = models.CharField('ID de entidad', max_length=50, blank=True)
    detalle = models.JSONField('detalle', default=dict, blank=True)
    ip_address = models.GenericIPAddressField('dirección IP', null=True, blank=True)
    fecha = models.DateTimeField('fecha', auto_now_add=True)

    class Meta:
        verbose_name = 'log de actividad'
        verbose_name_plural = 'logs de actividad'
        ordering = ['-fecha']
        indexes = [
            models.Index(fields=['usuario', '-fecha'], name='log_usuario_fecha_idx'),
            models.Index(fields=['entidad_afectada', 'entidad_id'], name='log_entidad_idx'),
            models.Index(fields=['accion'], name='log_accion_idx'),
        ]

    def __str__(self):
        return f'{self.fecha:%Y-%m-%d %H:%M} · {self.accion} · {self.entidad_afectada}'
