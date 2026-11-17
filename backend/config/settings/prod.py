"""Configuración de producción."""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import SECRET_KEY, env

DEBUG = False

if not SECRET_KEY:
    raise ImproperlyConfigured('La variable DJANGO_SECRET_KEY es obligatoria en producción.')

DATABASES = {'default': env.db('DATABASE_URL')}

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = env.bool('DJANGO_SECURE_SSL_REDIRECT', default=False)
SESSION_COOKIE_SECURE = env.bool('DJANGO_SECURE_COOKIES', default=True)
CSRF_COOKIE_SECURE = env.bool('DJANGO_SECURE_COOKIES', default=True)
SECURE_HSTS_SECONDS = env.int('DJANGO_HSTS_SECONDS', default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[])
