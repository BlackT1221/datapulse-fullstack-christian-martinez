"""Configuración de desarrollo y pruebas locales."""
import os

from django.core.management.utils import get_random_secret_key

from .base import *  # noqa: F401,F403
from .base import BASE_DIR, SECRET_KEY, env

DEBUG = env.bool('DJANGO_DEBUG', default=True)

# Si no se define en .env se genera una clave efímera (solo desarrollo).
SECRET_KEY = SECRET_KEY or get_random_secret_key()

# Sin DATABASE_URL (p. ej. `pytest` local) se usa SQLite como respaldo.
if os.environ.get('DATABASE_URL'):
    DATABASES = {'default': env.db('DATABASE_URL')}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
