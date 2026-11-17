from django.contrib import admin

from .models import IndicadorEconomico, Pais, TipoCambio


@admin.register(Pais)
class PaisAdmin(admin.ModelAdmin):
    list_display = ('codigo_iso', 'nombre', 'moneda_codigo', 'region', 'poblacion', 'activo')
    list_filter = ('region', 'activo')
    search_fields = ('codigo_iso', 'nombre', 'moneda_codigo', 'moneda_nombre')
    ordering = ('nombre',)


@admin.register(IndicadorEconomico)
class IndicadorEconomicoAdmin(admin.ModelAdmin):
    list_display = ('pais', 'tipo', 'anio', 'valor', 'unidad', 'fuente', 'fecha_actualizacion')
    list_filter = ('tipo', 'anio', 'fuente', 'pais')
    search_fields = ('pais__nombre', 'pais__codigo_iso')
    list_select_related = ('pais',)
    ordering = ('pais', 'tipo', '-anio')


@admin.register(TipoCambio)
class TipoCambioAdmin(admin.ModelAdmin):
    list_display = ('moneda_origen', 'moneda_destino', 'fecha', 'tasa', 'variacion_porcentual', 'fuente')
    list_filter = ('moneda_origen', 'fuente')
    search_fields = ('moneda_origen__moneda_codigo', 'moneda_origen__nombre')
    list_select_related = ('moneda_origen',)
    date_hierarchy = 'fecha'
    ordering = ('moneda_origen', '-fecha')
