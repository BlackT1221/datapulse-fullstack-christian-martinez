"""Configuración de producción (Docker Compose o Render)."""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import ALLOWED_HOSTS, SECRET_KEY, env

DEBUG = False

if not SECRET_KEY:
    raise ImproperlyConfigured('La variable DJANGO_SECRET_KEY es obligatoria en producción.')

# --- Base de datos ---------------------------------------------------------------------------------
# DATABASE_URL tipo postgres://usuario:clave@host:5432/bd. SSL configurable: "prefer" usa TLS si el
# servidor lo ofrece (Render) y sigue funcionando sin él (Postgres de docker-compose); usa "require"
# para forzarlo con una URL externa. Un `?sslmode=` dentro de la URL tiene prioridad.
DATABASES = {
    'default': env.db(
        'DATABASE_URL',
        engine='django.db.backends.postgresql',
    ),
}
DATABASES['default']['CONN_MAX_AGE'] = env.int('DATABASE_CONN_MAX_AGE', default=60)
DATABASES['default']['CONN_HEALTH_CHECKS'] = True
DATABASES['default'].setdefault('OPTIONS', {}).setdefault(
    'sslmode', env('DATABASE_SSLMODE', default='prefer'),
)

# --- Hosts / CSRF ------------------------------------------------------------------------------------
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[])

# Render inyecta el hostname público del servicio (p. ej. datapulse-backend.onrender.com).
RENDER_EXTERNAL_HOSTNAME = env('RENDER_EXTERNAL_HOSTNAME', default='')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, RENDER_EXTERNAL_HOSTNAME]
    CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, f'https://{RENDER_EXTERNAL_HOSTNAME}']

# --- Archivos estáticos (WhiteNoise) -----------------------------------------------------------------
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# --- Seguridad HTTPS (Render termina TLS en su proxy) -------------------------------------------------
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = env.bool('DJANGO_SECURE_SSL_REDIRECT', default=False)
SESSION_COOKIE_SECURE = env.bool('DJANGO_SECURE_COOKIES', default=True)
CSRF_COOKIE_SECURE = env.bool('DJANGO_SECURE_COOKIES', default=True)
SECURE_HSTS_SECONDS = env.int('DJANGO_HSTS_SECONDS', default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
