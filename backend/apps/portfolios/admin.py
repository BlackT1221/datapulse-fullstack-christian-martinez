from django.contrib import admin

from .models import Portafolio, Posicion


class PosicionInline(admin.TabularInline):
    model = Posicion
    extra = 0
    autocomplete_fields = ('pais',)
    fields = ('pais', 'tipo_activo', 'monto_inversion_usd', 'fecha_entrada', 'fecha_salida', 'notas')


@admin.register(Portafolio)
class PortafolioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'usuario', 'es_publico', 'activo', 'fecha_creacion', 'fecha_modificacion')
    list_filter = ('es_publico', 'activo')
    search_fields = ('nombre', 'descripcion', 'usuario__email')
    list_select_related = ('usuario',)
    readonly_fields = ('fecha_creacion', 'fecha_modificacion')
    inlines = (PosicionInline,)
    ordering = ('-fecha_modificacion',)


@admin.register(Posicion)
class PosicionAdmin(admin.ModelAdmin):
    list_display = (
        'portafolio', 'pais', 'tipo_activo', 'monto_inversion_usd', 'fecha_entrada', 'fecha_salida',
    )
    list_filter = ('tipo_activo', 'pais')
    search_fields = ('portafolio__nombre', 'pais__nombre', 'notas')
    list_select_related = ('portafolio', 'pais')
    autocomplete_fields = ('portafolio', 'pais')
    ordering = ('-fecha_entrada',)
