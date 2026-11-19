"""
Carga datos de referencia de forma idempotente: se puede ejecutar varias veces sin duplicar registros.

Uso:  python manage.py seed_data
La contraseña de los usuarios de prueba puede cambiarse con la variable SEED_USER_PASSWORD.
"""
import datetime
import os
import random
from decimal import ROUND_HALF_UP, Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.seed import datos
from apps.countries.models import IndicadorEconomico, Pais, TipoCambio
from apps.portfolios.models import Portafolio, Posicion
from apps.risk.models import Alerta
from apps.risk.services import calcular_irpc_pais, generar_alerta_hiperinflacion, generar_alerta_tipo_cambio

PASSWORD_POR_DEFECTO = 'DataPulse2026!'  # Credencial pública de demo definida en SPEC §6.3.


def _decimal(valor, decimales):
    return Decimal(str(valor)).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP)


class Command(BaseCommand):
    help = (
        'Carga países, usuarios, indicadores, tipos de cambio, portafolios de ejemplo '
        'índices de riesgo y alertas iniciales (idempotente).'
    )

    @transaction.atomic
    def handle(self, *args, **options):
        hoy = timezone.localdate()
        paises = self._paises()
        usuarios = self._usuarios()
        indicadores = self._indicadores(paises)
        tipos_cambio = self._tipos_cambio(paises, hoy)
        portafolios, posiciones = self._portafolios(paises, usuarios, hoy)
        indices = self._indices_riesgo(paises)
        self._alertas_iniciales(paises)
        self.stdout.write(self.style.SUCCESS(
            f'Seed completado: {len(paises)} países, {len(usuarios)} usuarios, {indicadores} indicadores, '
            f'{tipos_cambio} tipos de cambio, {portafolios} portafolios, {posiciones} posiciones, '
            f'{indices} índices de riesgo, {Alerta.objects.count()} alertas.'
        ))

    def _paises(self):
        paises = {}
        for iso, (nombre, moneda, moneda_nombre, region, lat, lon, poblacion) in datos.PAISES.items():
            paises[iso], _ = Pais.objects.update_or_create(
                codigo_iso=iso,
                defaults={
                    'nombre': nombre, 'moneda_codigo': moneda, 'moneda_nombre': moneda_nombre,
                    'region': region, 'latitud': Decimal(lat), 'longitud': Decimal(lon),
                    'poblacion': poblacion, 'bandera_url': datos.BANDERA_URL.format(iso=iso.lower()),
                    'activo': True,
                },
            )
        return paises

    def _usuarios(self):
        password = os.environ.get('SEED_USER_PASSWORD') or PASSWORD_POR_DEFECTO
        modelo = get_user_model()
        usuarios = {}
        for email, nombre, rol in datos.USUARIOS:
            es_admin = rol == modelo.Rol.ADMIN
            usuario, _ = modelo.objects.update_or_create(
                email=email,
                defaults={
                    'username': email, 'nombre_completo': nombre, 'rol': rol, 'activo': True,
                    'is_staff': es_admin, 'is_superuser': es_admin,
                },
            )
            if not usuario.check_password(password):
                usuario.set_password(password)
                usuario.save(update_fields=['password'])
            usuarios[email] = usuario
        return usuarios

    def _indicadores(self, paises):
        total = 0
        for iso, por_tipo in datos.INDICADORES.items():
            for tipo, valores in por_tipo.items():
                for anio, valor in zip(datos.ANIOS, valores):
                    IndicadorEconomico.objects.update_or_create(
                        pais=paises[iso], tipo=tipo, anio=anio,
                        defaults={
                            'valor': _decimal(valor, 4), 'unidad': datos.UNIDADES[tipo],
                            'fuente': IndicadorEconomico.Fuente.MANUAL,
                        },
                    )
                    total += 1
        return total

    def _tipos_cambio(self, paises, hoy):
        """Serie determinista de 30 días (paseo aleatorio con semilla fija por moneda) que termina en hoy."""
        por_moneda = {pais.moneda_codigo: pais for pais in paises.values()}
        total = 0
        for moneda, (tasa_actual, volatilidad, deriva) in datos.TIPOS_CAMBIO.items():
            generador = random.Random(f'datapulse-{moneda}')
            variaciones = [generador.gauss(deriva, volatilidad) for _ in range(datos.DIAS_TIPO_CAMBIO)]
            # Se reconstruye la serie hacia atrás para que el último día coincida con la tasa actual.
            tasas = [tasa_actual]
            for variacion in reversed(variaciones[1:]):
                tasas.insert(0, tasas[0] / (1 + variacion / 100))
            for indice, tasa in enumerate(tasas):
                fecha = hoy - datetime.timedelta(days=datos.DIAS_TIPO_CAMBIO - 1 - indice)
                TipoCambio.objects.update_or_create(
                    moneda_origen=por_moneda[moneda], moneda_destino='USD', fecha=fecha,
                    defaults={
                        'tasa': _decimal(tasa, 6),
                        'variacion_porcentual': _decimal(variaciones[indice], 4),
                        'fuente': 'SEED',
                    },
                )
                total += 1
        return total

    def _portafolios(self, paises, usuarios, hoy):
        total_posiciones = 0
        for definicion in datos.PORTAFOLIOS:
            portafolio, _ = Portafolio.objects.update_or_create(
                usuario=usuarios[definicion['usuario']], nombre=definicion['nombre'],
                defaults={
                    'descripcion': definicion['descripcion'], 'es_publico': definicion['es_publico'],
                    'activo': True,
                },
            )
            for iso, tipo, monto, dias_entrada, dias_salida, notas in definicion['posiciones']:
                Posicion.objects.update_or_create(
                    portafolio=portafolio, pais=paises[iso], tipo_activo=tipo, notas=notas,
                    defaults={
                        'monto_inversion_usd': Decimal(monto),
                        'fecha_entrada': hoy - datetime.timedelta(days=dias_entrada),
                        'fecha_salida': (
                            hoy - datetime.timedelta(days=dias_salida) if dias_salida is not None else None
                        ),
                    },
                )
                total_posiciones += 1
        return len(datos.PORTAFOLIOS), total_posiciones

    def _indices_riesgo(self, paises):
        """Cálculo inicial del IRPC; al re-ejecutar se actualiza el último índice en lugar de duplicarlo."""
        for pais in paises.values():
            calcular_irpc_pais(pais, reemplazar_ultimo=True)
        return len(paises)

    def _alertas_iniciales(self, paises):
        """
        Aplica a los datos precargados las reglas 3 (variación cambiaria > 3 %) y 5 (hiperinflación),
        que en operación normal disparan las tareas de sincronización. Las reglas 1 y 2 ya las aplica
        `calcular_irpc_pais`. Las alertas sin leer no se duplican al re-ejecutar el seed.
        """
        for tipo_cambio in TipoCambio.objects.filter(moneda_origen__in=paises.values()).select_related(
            'moneda_origen'
        ):
            generar_alerta_tipo_cambio(tipo_cambio)
        for pais in paises.values():
            inflacion = (pais.indicadores.filter(tipo=IndicadorEconomico.Tipo.INFLACION)
                         .order_by('-anio').first())
            if inflacion is not None:
                generar_alerta_hiperinflacion(inflacion)
