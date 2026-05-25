FROM python:3.11-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 rms && useradd -u 1001 -g rms -m -s /usr/sbin/nologin rms

WORKDIR /app

COPY docker/ai-service/requirements.txt docker/ai-service/app.py ./

RUN pip install --no-cache-dir -r requirements.txt \
    && chown -R rms:rms /app

USER rms

ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health')"

CMD ["python", "app.py"]
