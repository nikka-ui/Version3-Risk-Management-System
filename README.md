# Version 3 — AI Risk Management System

ISO 31000-aligned enterprise risk management with AI-assisted categorization, multi-role workflows (Supervisor, RMO, Audit, Executive), and Docker-based deployment.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and workflow |
| [docs/PORT_REGISTRY.md](docs/PORT_REGISTRY.md) | Port assignments (authoritative) |
| [docs/DOCKER.md](docs/DOCKER.md) | Run Docker dev/prod stacks |
| [docs/CONTAINER_SECURITY.md](docs/CONTAINER_SECURITY.md) | Container hardening |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Environment variables |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Backups, updates, incidents |

Original specifications: `V2_AI_Risk_Management_System_Documentation.docx`, `RMS FLOWCHART.png`.

## Quick start (Docker)

**Prerequisites:** Docker Desktop or Docker Engine 24+

```powershell
# 1. Environment and secrets
Copy-Item .env.example .env
Copy-Item docker\secrets\db_password.txt.example docker\secrets\db_password.txt
Copy-Item docker\secrets\app_key.txt.example docker\secrets\app_key.txt

# 2. Start stack
docker compose -f docker/compose.yml -f docker/compose.override.yml up --build -d

# 3. Verify
curl http://localhost:8080/health
```

- Application URL: http://localhost:8080
- **Login:** http://localhost:8080/login — see [docs/LOGIN.md](docs/LOGIN.md) for built-in accounts
- **IT Admin:** http://localhost:8080/admin (`admin` / `a3c1993`) — accounts, roles, logs
- **Department Supervisor:** http://localhost:8080/supervisor (`personnel` / `a3c2026`) — risk reports, tickets, accomplishments
- API (placeholder): http://localhost:8080/api/
- PostgreSQL (dev, localhost only): `127.0.0.1:5433`

Optional dev services (MinIO, Mailpit):

```powershell
docker compose -f docker/compose.yml -f docker/compose.override.yml --profile dev up -d
```

## Security notice

- **Never commit** `.env` or `docker/secrets/*.txt`
- Change default secrets before any shared or production deployment
- See [docs/CONTAINER_SECURITY.md](docs/CONTAINER_SECURITY.md)

## Repository structure

```
docker/           # Compose, Dockerfiles, nginx, secrets templates
docs/             # Architecture, ports, security, operations
.env.example      # Environment template
```

Application code (Laravel, Next.js, Flask ML) will replace placeholder containers under `docker/api`, `docker/web`, and `docker/ai-service`.

## License

Internal use — ACCC development team.
