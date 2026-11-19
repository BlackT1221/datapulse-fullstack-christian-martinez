from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ('email', 'nombre_completo', 'rol', 'activo', 'fecha_creacion')
    list_filter = ('rol', 'activo', 'is_staff')
    search_fields = ('email', 'nombre_completo')
    ordering = ('email',)
    fieldsets = UserAdmin.fieldsets + (
        ('DataPulse', {'fields': ('nombre_completo', 'rol', 'activo')}),
    )
