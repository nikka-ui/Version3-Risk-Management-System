# RMS Documentation

Documentation for the **Version 3 AI Risk Management System** — ISO 31000-aligned enterprise risk workflow with Docker-based deployment.

The **running application** is the Express RMS app in `docker/web` (session login, department ownership workflow, RMO oversight, President High/Critical approval). Treat [LOGIN.md](LOGIN.md) and [ARCHITECTURE.md](ARCHITECTURE.md) as current; older Word/flowchart assets are historical requirements.

## Source specifications

These in-repo Word documents and diagram are the original requirements (may still mention Audit Officer / older RMO ownership):

| Asset | Description |
|-------|-------------|
| [`V2_AI_Risk_Management_System_Documentation.docx`](../V2_AI_Risk_Management_System_Documentation.docx) | Full V2 specification (architecture, API, security, deployment) |
| [`AI_Risk_Management_System_Documentation.docx`](../AI_Risk_Management_System_Documentation.docx) | V1 overview |
| [`RMS FLOWCHART.png`](../RMS%20FLOWCHART.png) | Historical end-to-end swimlanes |

## Reading order

1. [Login accounts & roles (dev)](LOGIN.md) — **authoritative** built-in users, consoles, and capabilities
2. [Architecture](ARCHITECTURE.md) — current vs planned stack, workflow, statuses ([system flowchart](system-flowchart.png))
3. [Port Registry](PORT_REGISTRY.md) — authoritative port assignments
4. [Docker Guide](DOCKER.md) — run dev/prod compose stacks
5. [Container Security](CONTAINER_SECURITY.md) — hardening and threat model
6. [Environment Variables](ENVIRONMENT.md) — configuration contract
7. [Operations](OPERATIONS.md) — backups, ticket reset, updates, incidents
8. [ADR 001: Laravel backend](adr/001-backend-laravel.md) — default API stack decision (target)

## Quick links

- Docker files: [`docker/`](../docker/)
- Role registry: [`docker/web/config/roles.js`](../docker/web/config/roles.js)
- Environment template: [`.env.example`](../.env.example)
- Root README: [`README.md`](../README.md)
