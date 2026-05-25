# Environment Variables

Configuration contract for RMS Docker and application services. Copy [`.env.example`](../.env.example) to `.env` at the repository root.

## Variable reference

### Application

| Variable | Default | Used by | Description |
|----------|---------|---------|-------------|
| `APP_ENV` | `local` | api | `local`, `staging`, `production` |
| `APP_URL` | `http://localhost:8080` | api, web | Public URL (browser-facing) |
| `NODE_ENV` | `development` | web | Node runtime mode |
| `FLASK_ENV` | `development` | ai-service | Flask environment |

### Host ports (development)

| Variable | Default | Maps to |
|----------|---------|---------|
| `NGINX_HTTP_PORT` | `8080` | nginx → host |
| `POSTGRES_HOST_PORT` | `5433` | postgres → `127.0.0.1` |
| `AI_DEBUG_PORT` | `5001` | ai-service → `127.0.0.1` |
| `MINIO_API_PORT` | `9000` | minio API |
| `MINIO_CONSOLE_PORT` | `9001` | minio console |
| `MAILPIT_UI_PORT` | `8025` | mailpit UI |

### Database

| Variable | Default | Used by | Description |
|----------|---------|---------|-------------|
| `DB_HOST` | `postgres` | api, ai-service | Docker DNS name |
| `DB_PORT` | `5432` | api, ai-service | Container port |
| `DB_DATABASE` | `rms` | api, postgres | Database name |
| `DB_USERNAME` | `rms` | api, postgres | Database user |
| `DB_PASSWORD` | — | — | **Use secret file** `docker/secrets/db_password.txt` |

Postgres container reads `POSTGRES_PASSWORD_FILE=/run/secrets/db_password`.

### Redis

| Variable | Default | Used by |
|----------|---------|---------|
| `REDIS_HOST` | `redis` | api |
| `REDIS_PORT` | `6379` | api |

Connection URL (Laravel): `redis://redis:6379`

### AI service

| Variable | Default | Used by |
|----------|---------|---------|
| `AI_SERVICE_URL` | `http://ai-service:5000` | api |

Internal only — do not point browsers to this URL in production.

### File storage

| Variable | Default | Used by | Notes |
|----------|---------|---------|-------|
| `FILE_STORAGE_DRIVER` | `s3` | api | `s3` or `local` |
| `S3_ENDPOINT` | `http://minio:9000` | api | Dev MinIO only |
| `S3_BUCKET` | `rms-uploads` | api | Create bucket in MinIO console |
| `S3_ACCESS_KEY_ID` | — | api | Match MinIO root user in dev |
| `S3_SECRET_ACCESS_KEY` | — | api | Secret — use env or vault in prod |
| `S3_USE_PATH_STYLE_ENDPOINT` | `true` | api | Required for MinIO |

Production: use AWS S3 or Azure Blob with IAM-scoped credentials; do not run MinIO in prod compose.

### MinIO (dev profile)

| Variable | Default |
|----------|---------|
| `MINIO_ROOT_USER` | `rmsminio` |
| `MINIO_ROOT_PASSWORD` | `rmsminio-dev-change-me` |

Change before sharing dev environments.

### Authentication (when Laravel is added)

| Secret / variable | Location |
|-------------------|----------|
| `APP_KEY` | `docker/secrets/app_key.txt` |
| `SANCTUM_STATEFUL_DOMAINS` | `.env` — e.g. `localhost:8080` |

Generate Laravel key: `php artisan key:generate` (run inside `api` container).

## Docker secrets (not in .env)

| File | Compose secret name |
|------|---------------------|
| `docker/secrets/db_password.txt` | `db_password` |
| `docker/secrets/app_key.txt` | `app_key` |

Application containers can read via `DB_PASSWORD_FILE` and `APP_KEY_FILE` environment variables pointing to `/run/secrets/`.

## Environment-specific values

| Environment | `APP_ENV` | `APP_URL` | Notes |
|-------------|-----------|-----------|-------|
| Local dev | `local` | `http://localhost:8080` | Override + dev ports |
| Staging | `staging` | `https://rms-staging.example.com` | TLS required |
| Production | `production` | `https://rms.example.com` | prod compose, no dev profiles |

## Related

- [`.env.example`](../.env.example)
- [Docker Guide](DOCKER.md)
- [Container Security](CONTAINER_SECURITY.md)
