# Version 4 — AI Risk Management System

ISO 31000-aligned enterprise risk management with AI-assisted categorization, department ownership workflows (Ticket Reporter → Department Head → President for High/Critical), RMO governance oversight, Executive view-only dashboards, and Docker-based deployment.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/LOGIN.md](docs/LOGIN.md) | Roles, seed accounts, and consoles (**start here**) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and current workflow |
| [docs/PORT_REGISTRY.md](docs/PORT_REGISTRY.md) | Port assignments (authoritative) |
| [docs/DOCKER.md](docs/DOCKER.md) | Run Docker dev/prod stacks |
| [docs/CONTAINER_SECURITY.md](docs/CONTAINER_SECURITY.md) | Container hardening |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Environment variables |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Backups, resets, updates, incidents |

Original specifications: `V2_AI_Risk_Management_System_Documentation.docx`, `RMS FLOWCHART.png` (historical; prefer LOGIN + ARCHITECTURE for current roles).

## Roles (summary)

| Role | Console |
|------|---------|
| Ticket Reporter | `/supervisor` |
| Department Head / VP | `/dept` |
| Risk Management Officer (RMO) | `/officer` (oversight only) |
| President | `/president` (High/Critical) |
| Executive Committee | `/executive` (view only) |
| System Administrator | `/admin` |

Full credentials and capabilities: [docs/LOGIN.md](docs/LOGIN.md).

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
- **Login:** http://localhost:8080/login — [docs/LOGIN.md](docs/LOGIN.md)
- **Examples:** `admin` / `a3c1993` · `reporter` / `a3c2026` · `it-head` / `dept2026` · `rm-officer` / `a3c2026` · `president` / `a3c2026`
- API stub: http://localhost:8080/api/
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
docker/           # Compose, Dockerfiles, nginx, Express web app, secrets templates
docs/             # Architecture, login, ports, security, operations
.env.example      # Environment template
```

The live product UI and ticket workflow run in **`docker/web`** (Express). Laravel (`docker/api`) and expanded AI remain scaffold/target layers — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

Internal use — ACCC development team.
