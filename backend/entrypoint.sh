#!/bin/sh
# Arranque del contenedor (docker-compose y Render): espera la BD, migra, carga el seed y
# recopila estáticos antes de ejecutar el comando recibido (gunicorn por defecto).
set -e

echo "Esperando a la base de datos..."
python - <<'PY'
import os, sys, time
import psycopg

url = os.environ.get('DATABASE_URL')
if not url:
    sys.exit('DATABASE_URL no está definida.')
# Misma política SSL que config/settings/prod.py; un ?sslmode= en la URL tiene prioridad.
opciones = {} if 'sslmode=' in url else {'sslmode': os.environ.get('DATABASE_SSLMODE', 'prefer')}
for intento in range(30):
    try:
        psycopg.connect(url, connect_timeout=3, **opciones).close()
        sys.exit(0)
    except psycopg.OperationalError as exc:
        print(f'  intento {intento + 1}/30: {exc}'.strip(), flush=True)
        time.sleep(2)
sys.exit('No fue posible conectar con la base de datos.')
PY

python manage.py migrate --noinput

# seed_data es idempotente (update_or_create): seguro en cada arranque. DJANGO_SEED_ON_START=false lo omite.
if [ "${DJANGO_SEED_ON_START:-true}" = "true" ]; then
    python manage.py seed_data
fi

python manage.py collectstatic --noinput

exec "$@"
