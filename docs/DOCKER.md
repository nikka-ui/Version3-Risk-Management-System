# Docker Guide

Run the RMS stack locally or in production using Docker Compose.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Git clone of this repository
- Ports available per [Port Registry](PORT_REGISTRY.md) (default: `8080`)

## First-time setup

### 1. Environment file

```powershell
cd "C:\Users\IT Nikka\Documents\GitHub\Version2-Risk-Management-System"
Copy-Item .env.example .env
```

### 2. Docker secrets

```powershell
New-Item -ItemType Directory -Force -Path docker\secrets
Copy-Item docker\secrets\db_password.txt.example docker\secrets\db_password.txt
Copy-Item docker\secrets\app_key.txt.example docker\secrets\app_key.txt
# Edit both files with strong random values before production
```

Secret files are gitignored. Compose reads them from `docker/secrets/`.

### 3. Start development stack

From repository root:

```powershell
docker compose -f docker/compose.yml -f docker/compose.override.yml up --build -d
```

Optional dev tools (MinIO, Mailpit):

```powershell
docker compose -f docker/compose.yml -f docker/compose.override.yml --profile dev up -d
```

### 4. Verify health

```powershell
curl http://localhost:8080/health
curl http://localhost:8080/ai-health
curl http://localhost:8080/
```

Expected: JSON `{"status":"ok"}` from `/health` and `/ai-health`.

## Compose file layout

| File | Purpose |
|------|---------|
| [`docker/compose.yml`](../docker/compose.yml) | Base services, networks, volumes, secrets |
| [`docker/compose.override.yml`](../docker/compose.override.yml) | Dev: localhost DB/AI ports, optional profiles |
| [`docker/compose.prod.yml`](../docker/compose.prod.yml) | Prod: resource limits, read-only roots, 80/443 |

## Development vs production

| Mode | Command |
|------|---------|
| **Development** | `docker compose -f docker/compose.yml -f docker/compose.override.yml up -d` |
| **Production** | `docker compose -f docker/compose.yml -f docker/compose.prod.yml up -d` |

Production requires TLS certificates in `docker/nginx/certs/` (fullchain.pem, privkey.pem) and updated secrets.

## Service endpoints (development)

| URL | Service |
|-----|---------|
| http://localhost:8080/ | Frontend (placeholder) |
| http://localhost:8080/api/ | API (placeholder) |
| http://localhost:8080/health | nginx health |
| http://localhost:8080/ai-health | AI health (proxied) |
| http://127.0.0.1:5433 | PostgreSQL (host only) |
| http://127.0.0.1:5001 | AI service (direct debug) |
| http://127.0.0.1:8025 | Mailpit UI (`--profile dev`) |
| http://127.0.0.1:9001 | MinIO console (`--profile dev`) |

## Common commands

```powershell
# Validate compose configuration
docker compose -f docker/compose.yml -f docker/compose.override.yml config

# View logs
docker compose -f docker/compose.yml -f docker/compose.override.yml logs -f nginx api

# Stop and remove containers
docker compose -f docker/compose.yml -f docker/compose.override.yml down

# Stop and remove volumes (destructive)
docker compose -f docker/compose.yml -f docker/compose.override.yml down -v
```

## Placeholder images

Until application code is added:

- **web** — Express static placeholder on port 3000
- **api** — PHP/nginx stub with `/health` on port 8080
- **ai-service** — Flask `/health` on port 5000

Replace Dockerfiles under `docker/web`, `docker/api`, and `docker/ai-service` when scaffolding Laravel and Next.js.

## Replacing placeholders

### Laravel API

1. Create Laravel 11 app in `backend/` or project root.
2. Update `docker/api/Dockerfile` to copy application code and run `composer install`.
3. Run migrations: `docker compose exec api php artisan migrate`

### Next.js frontend

1. Scaffold Next.js 14 in `frontend/`.
2. Update `docker/web/Dockerfile` for `output: 'standalone'` build.
3. Set `NEXT_PUBLIC_API_URL` to `/api/v1`.

### AI service

1. Implement NLP and classification in `docker/ai-service/` or `ai-service/`.
2. Expose `/classify` and `/summarize` per V2 API contract.

## Troubleshooting

| Issue | Action |
|-------|--------|
| `secret file not found` | Create `docker/secrets/db_password.txt` and `app_key.txt` |
| Port 8080 in use | Set `NGINX_HTTP_PORT` in `.env` |
| `rms_data` network unreachable | Ensure `postgres` and `redis` are healthy: `docker compose ps` |
| API 502 via nginx | Wait for `api` healthcheck; check `docker compose logs api` |

## Related

- [Port Registry](PORT_REGISTRY.md)
- [Container Security](CONTAINER_SECURITY.md)
- [Environment Variables](ENVIRONMENT.md)
