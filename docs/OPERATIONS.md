# Operations Guide

Day-two operations for the RMS Docker deployment.

## Image management

- Pin base image tags in [`docker/compose.yml`](../docker/compose.yml) (avoid `latest`).
- Rebuild application images after dependency updates:

```powershell
docker compose -f docker/compose.yml -f docker/compose.prod.yml build --no-cache api web ai-service
```

- Scan images before release (Docker Scout, Trivy, or equivalent).

## Backups

### PostgreSQL

```powershell
docker compose -f docker/compose.yml exec postgres pg_dump -U rms rms > backup_rms_$(Get-Date -Format yyyyMMdd).sql
```

Schedule daily backups with retention per policy (recommended: 30 days minimum).

Restore:

```powershell
Get-Content backup.sql | docker compose -f docker/compose.yml exec -T postgres psql -U rms -d rms
```

### Redis

Redis holds ephemeral cache/queue data. Persist AOF volume `rms_redis_data` but prioritize Postgres for disaster recovery.

### Object storage

- **Dev:** MinIO data in volume `rms_minio_data`
- **Prod:** Use managed S3 with versioning and lifecycle rules

## Updates and maintenance

1. Announce maintenance window.
2. `docker compose pull` for infrastructure images (postgres, redis, nginx).
3. Rebuild custom images (`api`, `web`, `ai-service`).
4. `docker compose up -d` with prod compose files.
5. Run database migrations inside `api` container.
6. Verify `/health` and smoke-test critical workflows.

## Monitoring

| Check | Endpoint / command |
|-------|-------------------|
| Edge health | `GET /health` on nginx |
| AI health | `GET /ai-health` |
| Container status | `docker compose ps` |
| Resource usage | `docker stats` |

Integrate with your monitoring stack (Prometheus, Datadog, etc.) in a future CI/CD phase.

## Logs

```powershell
docker compose -f docker/compose.yml logs --tail=200 nginx api ai-service
```

Configure a log driver for production (e.g. `json-file` max-size or centralized collector).

## Incident response

| Scenario | Action |
|----------|--------|
| Suspected breach | Rotate `db_password` and `app_key` secrets; restart affected containers |
| DB corruption | Restore from latest `pg_dump`; review audit logs |
| AI service abuse | Block external access to port 5001; review API rate limits |
| Container compromise | `docker compose down`; rebuild images from clean base; redeploy |

## Production checklist

- [ ] TLS certificates installed in `docker/nginx/certs/`
- [ ] Secrets generated and stored outside git
- [ ] Dev profiles (`dev`, MinIO, Mailpit) not enabled
- [ ] Firewall allows only 80/443
- [ ] Backups automated and tested
- [ ] Image vulnerability scan in CI (planned)

## Related

- [Container Security](CONTAINER_SECURITY.md)
- [Docker Guide](DOCKER.md)
