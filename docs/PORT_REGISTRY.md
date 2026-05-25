# Port Registry

Authoritative port assignments for the AI Risk Management System (RMS) Docker stack. All host bindings must match [`docker/compose.yml`](../docker/compose.yml) and override files.

## Principles

1. **Single public entry** — Only `nginx` exposes HTTP/HTTPS to the host in production.
2. **Data services are internal** — PostgreSQL and Redis are not published to `0.0.0.0`.
3. **Dev overrides use localhost** — When a data service must be reachable from the host (debugging), bind to `127.0.0.1` only.
4. **Document before change** — Update this file and run `docker compose config` before changing any `ports:` mapping.

## Reserved port ranges

| Range | Purpose |
|-------|---------|
| 3000–3099 | Frontend applications (Next.js, etc.) |
| 5000–5099 | AI / ML HTTP services |
| 8000–8099 | Reverse proxy and public HTTP APIs |
| 5400–5499 | PostgreSQL host overrides (development only) |
| 6379 | Redis (container port only; never publish to `0.0.0.0`) |
| 9000–9099 | Object storage (MinIO dev) |

## Service port map

| Service | Container port(s) | Host (development) | Host (production) | Docker network(s) | Published to internet |
|---------|-------------------|--------------------|-------------------|-------------------|----------------------|
| `nginx` | 80, 443 | `8080` → 80 | `80`, `443` | `rms_edge`, `rms_app` | Yes (edge only) |
| `web` | 3000 | — (via nginx) | — | `rms_app` | No |
| `api` | 8080 (internal nginx) | — | — | `rms_app` | No |
| `api-php` (php-fpm) | 9000 | — | — | `rms_app` | No (localhost only) |
| `ai-service` | 5000 | `127.0.0.1:5001` (profile `ai-debug`) | — | `rms_app` | No |
| `postgres` | 5432 | `127.0.0.1:5433` (profile `dev-db`) | — | `rms_data` | No |
| `redis` | 6379 | — | — | `rms_data` | No |
| `minio` | 9000 (API), 9001 (console) | `127.0.0.1:9000`, `127.0.0.1:9001` (profile `dev`) | — | `rms_data` | No |
| `mailpit` | 1025 (SMTP), 8025 (UI) | `127.0.0.1:8025` (profile `dev`) | — | `rms_app` | No |

## URL routing (via nginx)

| Path | Upstream | Notes |
|------|----------|-------|
| `/` | `web:3000` | Frontend SPA |
| `/api/` | `api:80` | Laravel API (`/api/v1/` in application) |
| `/health` | nginx local | Stack health check |
| `/ai-health` | `ai-service:5000/health` | AI service health (internal route) |

## Environment-driven URLs

Containers communicate using **service names**, not `localhost`:

| Variable | Default (compose) | Consumer |
|----------|-------------------|----------|
| `APP_URL` | `http://localhost:8080` | API, frontend (browser-facing) |
| `DB_HOST` | `postgres` | API, AI service |
| `DB_PORT` | `5432` | API, AI service |
| `REDIS_HOST` | `redis` | API |
| `REDIS_PORT` | `6379` | API |
| `AI_SERVICE_URL` | `http://ai-service:5000` | API |
| `S3_ENDPOINT` | `http://minio:9000` | API (dev profile only) |

## Changing ports

1. Edit compose file(s) under `docker/`.
2. Update this registry and [`ENVIRONMENT.md`](ENVIRONMENT.md).
3. Update [`DOCKER.md`](DOCKER.md) quick-start examples.
4. Run: `docker compose -f docker/compose.yml config`

## Firewall guidance (production host)

- Allow inbound: **80**, **443** (nginx only).
- Deny inbound: 5432, 6379, 5000, 3000, 9000 from non-admin networks.
- Restrict SSH/admin access separately from application ports.
