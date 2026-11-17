from django.contrib import admin

from .models import LogActividad


@admin.register(LogActividad)
class LogActividadAdmin(admin.ModelAdmin):
    """Registro de auditoría: solo lectura desde el admin."""

    list_display = ('fecha', 'usuario', 'accion', 'entidad_afectada', 'entidad_id', 'ip_address')
    list_filter = ('accion', 'entidad_afectada')
    search_fields = ('usuario__email', 'entidad_afectada', 'entidad_id', 'ip_address')
    list_select_related = ('usuario',)
    date_hierarchy = 'fecha'
    ordering = ('-fecha',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
