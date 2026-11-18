FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# INSTALL_DEV=true añade pytest, pytest-django y flake8 (docker-compose local lo activa por defecto);
# el despliegue en nube construye con el valor por defecto y la imagen queda sin herramientas de test.
ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt ./
RUN if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; \
    else pip install -r requirements.txt; fi

COPY . .
RUN chmod +x entrypoint.sh \
    && useradd --create-home --uid 1000 appuser \
    && mkdir -p staticfiles media \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
