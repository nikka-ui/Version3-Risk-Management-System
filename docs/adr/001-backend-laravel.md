# ADR 001: Default backend — Laravel 11

## Status

Accepted

## Context

The V2 specification allows either **Laravel 11** or **Node.js 20 + Express** for the API layer. The Docker scaffold must pick one default to avoid maintaining two parallel compose stacks.

## Decision

Use **Laravel 11 with PHP 8.3-FPM**, internal nginx, and **Laravel Sanctum** for authentication as the default `api` container.

## Consequences

### Positive

- Aligns with V2 deployment examples and Sanctum/JWT guidance
- Mature RBAC, migrations, and queue integration with Redis
- Single `api` Dockerfile pattern documented in [`DOCKER.md`](../DOCKER.md)

### Negative

- Teams preferring Node must swap the `api` service implementation
- PHP-FPM + nginx adds container complexity vs a single Node process

## Node.js alternative

To switch to Node.js:

1. Replace [`docker/api/Dockerfile`](../../docker/api/Dockerfile) with Node 20 Alpine image.
2. Listen on port **8080** (keep [Port Registry](../PORT_REGISTRY.md) upstream unchanged).
3. Implement `/api/v1/` routes and JWT auth per V2 spec.
4. Update health check to `GET /health` on the Node listener.

Networks, secrets, postgres, redis, and ai-service definitions remain unchanged.

## References

- [`V2_AI_Risk_Management_System_Documentation.docx`](../../V2_AI_Risk_Management_System_Documentation.docx)
- [`ARCHITECTURE.md`](../ARCHITECTURE.md)
