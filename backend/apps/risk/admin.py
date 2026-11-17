from django.contrib import admin

from .models import Alerta, IndiceRiesgo


@admin.register(IndiceRiesgo)
class IndiceRiesgoAdmin(admin.ModelAdmin):
    list_display = (
        'pais', 'fecha_calculo', 'indice_compuesto', 'nivel_riesgo',
        'score_economico', 'score_cambiario', 'score_estabilidad',
    )
    list_filter = ('nivel_riesgo', 'pais')
    search_fields = ('pais__nombre', 'pais__codigo_iso')
    list_select_related = ('pais',)
    date_hierarchy = 'fecha_calculo'
    ordering = ('-fecha_calculo',)


@admin.register(Alerta)
class AlertaAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'pais', 'tipo_alerta', 'severidad', 'usuario', 'leida', 'fecha_creacion')
    list_filter = ('tipo_alerta', 'severidad', 'leida', 'pais')
    search_fields = ('titulo', 'mensaje', 'usuario__email')
    list_select_related = ('pais', 'usuario')
    date_hierarchy = 'fecha_creacion'
    ordering = ('-fecha_creacion',)
    actions = ('marcar_como_leidas',)

    @admin.action(description='Marcar alertas seleccionadas como leídas')
    def marcar_como_leidas(self, request, queryset):
        actualizadas = queryset.update(leida=True)
        self.message_user(request, f'{actualizadas} alerta(s) marcada(s) como leída(s).')
