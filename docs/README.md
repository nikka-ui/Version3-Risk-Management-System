# RMS Documentation

Documentation for the **Version 2 AI Risk Management System** — ISO 31000-aligned enterprise risk workflow with Docker-based deployment.

## Source specifications

These in-repo Word documents and diagram are the original requirements:

| Asset | Description |
|-------|-------------|
| [`V2_AI_Risk_Management_System_Documentation.docx`](../V2_AI_Risk_Management_System_Documentation.docx) | Full V2 specification (architecture, API, security, deployment) |
| [`AI_Risk_Management_System_Documentation.docx`](../AI_Risk_Management_System_Documentation.docx) | V1 overview |
| [`RMS FLOWCHART.png`](../RMS%20FLOWCHART.png) | End-to-end workflow swimlanes |

## Reading order

1. [Login accounts (dev)](LOGIN.md) — built-in users and sign-in URL
2. [Architecture](ARCHITECTURE.md) — system design and workflow
3. [Port Registry](PORT_REGISTRY.md) — authoritative port assignments
4. [Docker Guide](DOCKER.md) — run dev/prod compose stacks
5. [Container Security](CONTAINER_SECURITY.md) — hardening and threat model
6. [Environment Variables](ENVIRONMENT.md) — configuration contract
7. [Operations](OPERATIONS.md) — backups, updates, incidents
8. [ADR 001: Laravel backend](adr/001-backend-laravel.md) — default stack decision

## Quick links

- Docker files: [`docker/`](../docker/)
- Environment template: [`.env.example`](../.env.example)
- Root README: [`README.md`](../README.md)
