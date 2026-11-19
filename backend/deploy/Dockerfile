# Image de l'application AGAPY-GALLERY (Django + Gunicorn). Contexte de construction : le dossier backend/
#   docker build -f deploy/Dockerfile -t agapy-gallery-backend .
FROM python:3.14-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential pkg-config default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.settings
# libmariadb3 : client MySQL ; ffmpeg : ffprobe mesure la durée réelle des vidéos WebM
RUN apt-get update && apt-get install -y --no-install-recommends libmariadb3 ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 agapy
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels
WORKDIR /app
COPY --chown=agapy:agapy . .
RUN mkdir -p /app/media /app/staticfiles && chown -R agapy:agapy /app/media /app/staticfiles
USER agapy
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python deploy/healthcheck.py
CMD ["gunicorn", "config.wsgi:application", "-c", "deploy/gunicorn.conf.py", "--bind", "0.0.0.0:8010"]
