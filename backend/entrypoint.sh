#!/bin/sh
set -e

echo "Esperando a la base de datos..."
python - <<'PY'
import os, sys, time
import psycopg
import environ

url = environ.Env.db_url_config(os.environ['DATABASE_URL'])
for intento in range(30):
    try:
        psycopg.connect(
            dbname=url['NAME'], user=url['USER'], password=url['PASSWORD'],
            host=url['HOST'], port=url['PORT'] or 5432, connect_timeout=3,
        ).close()
        sys.exit(0)
    except psycopg.OperationalError:
        time.sleep(2)
sys.exit('No fue posible conectar con la base de datos.')
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"
