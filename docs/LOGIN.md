# Login and built-in accounts (development)

The web application provides a side-panel login page at `/login`. Authentication is **session-based** (cookie) in the Express app under `docker/web`.

## Access URL

| Environment | URL |
|-------------|-----|
| Docker (default) | http://localhost:8080/login |
| Web container direct | http://localhost:3000/login (internal network only) |

## Roles (canonical)

Source of truth: [`docker/web/config/roles.js`](../docker/web/config/roles.js).

| Role id | Label | Console path | Assignable in User Management |
|---------|-------|--------------|-------------------------------|
| `supervisor` | Ticket Reporter | `/supervisor` | Yes |
| `dept_head` | Department Head / Vice President | `/dept` | Yes |
| `rm_officer` | Risk Management Officer (RMO) | `/officer` | Yes |
| `executive` | Executive Committee | `/executive` | Yes |
| `president` | President | `/president` | Yes |
| `admin` | System Administrator | `/admin` | Yes |
| `employee` | Employee | `/dashboard` | No (registry stub only) |

There is **no Audit Officer** console. RMO is **governance oversight only** — departments own tickets; the President approves High/Critical plans and finals.

## Built-in credentials (seed accounts)

Defined in [`docker/web/config/users.js`](../docker/web/config/users.js). Usernames are case-insensitive at login.

| Username | Password | Role |
|----------|----------|------|
| `admin` | `a3c1993` | System Administrator |
| `sys-admin` | `a3c2026` | System Administrator |
| `reporter` | `a3c2026` | Ticket Reporter |
| `it-head` | `dept2026` | Department Head (Information Technology) |
| `fin-head` | `dept2026` | Department Head (Finance) |
| `ops-head` | `dept2026` | Department Head (Operations) |
| `admin-head` | `dept2026` | Department Head (Administration) |
| `rm-officer` | `a3c2026` | Risk Management Officer |
| `president` | `a3c2026` | President |
| `executive` | `a3c2026` | Executive Committee |

**Do not use these passwords in production.**

## Ticket Reporter (`supervisor`)

Sign in as `reporter` / `a3c2026` → http://localhost:8080/supervisor

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/supervisor` | Summary and quick links |
| Drafts / tickets | `/supervisor/tickets` | Create, edit drafts, track submitted work |
| New report | `/supervisor/tickets/new` | 5W1H risk report |
| Ticket detail | `/supervisor/tickets/:ref` | View, revise returned tickets, implement plans, accomplishments |
| Returned / action | `/supervisor/actions` (and related queues) | Tickets needing revision or implementation |
| Accomplishments | `/supervisor/accomplishments` | Accomplishment history |
| Notifications | `/supervisor/notifications` | In-app alerts |
| Profile | `/supervisor/profile` | Account profile |

**Submit rules:** All 5W1H fields and **at least one evidence file** (PDF/PNG/JPG) are required. Evidence metadata is stored in PostgreSQL (`risk_attachments`); file bytes go to MinIO/S3 (not `store.json`).

**Revision:** When status is `returned` or `ownership_rejected`, the reporter must change the report before resubmit. Reporters do **not** own tickets or write action plans.

## Department Head / Vice President (`dept_head`)

Sign in as `it-head` (or other `*-head`) / `dept2026` → http://localhost:8080/dept

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/dept` | Department dashboard |
| Inbox | `/dept/inbox` (or tickets inbox) | Newly assigned tickets — accept, reject, or reassign |
| Active / drafts | `/dept/...` | In-progress ownership, action plans, personnel, documents |
| Returned tickets | `/dept/returned` | Plans or finals returned/rejected by the President |
| Overdue / pending closure | Dept queues | SLA and closure after accomplishment |
| Ticket detail | `/dept/tickets/:ref` | Ownership actions, action plan draft/publish, resolution |

**Ownership:** After accept (`in_progress`), the head builds and publishes an action plan.

- **Low / Moderate** → published plan goes to the reporter (`in_mitigation`).
- **High / Critical** → plan goes to the President (`pending_president`).

**Return to reporter** for report revision is allowed only **after ownership is accepted**. Closing after accomplishment uses department closure for Low/Moderate; High/Critical final decisions go through the President.

## Risk Management Officer — RMO (`rm_officer`)

Sign in as `rm-officer` / `a3c2026` → http://localhost:8080/officer

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/officer` | Governance dashboard |
| Risk register | `/officer/tickets` | Organization-wide tickets (view) |
| Overdue & SLA | `/officer/overdue` | SLA / overdue monitoring |
| Monitoring | `/officer/monitoring` | Lifecycle monitoring |
| Ticket detail | `/officer/tickets/:ref` | View, thread comments, reopen closed tickets |

RMO **cannot** accept ownership, edit mitigation plans, or close tickets as owner. Reopen of closed tickets (reassign to department) is allowed for governance.

## President (`president`)

Sign in as `president` / `a3c2026` → http://localhost:8080/president

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview / queues | `/president` | Pending High/Critical work |
| Ticket detail | `/president/tickets/:ref` | Approve, reject, or return (reason required for reject/return) |

Scope is **High and Critical** only:

1. **Action-plan phase** (`pending_president`) — approve / reject / return the department plan.
2. **Final phase** (`pending_president_final`) — final close/approve / return.

Notifications for this role are filtered to High/Critical.

## Executive Committee (`executive`)

Sign in as `executive` / `a3c2026` → http://localhost:8080/executive

View-only oversight: dashboard, heatmap, reports, trends, statistics, department performance, ticket detail and comments. Notifications are High/Critical only. Pill/UI: “View only”.

## System Administrator (`admin`)

Sign in as `admin` / `a3c1993` (or `sys-admin` / `a3c2026`) → http://localhost:8080/admin

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/admin` | Summary and quick links |
| Users | `/admin/users` | Create/edit users, roles, employee IDs (`EMP-###`), password reset |
| Departments | `/admin/departments` | Department catalog |
| Positions | `/admin/positions` | Position catalog |
| Tickets | `/admin/tickets` | View / soft-delete tickets (no workflow approve/close) |
| Audit logs | `/admin/audit-logs` | Administrator and system action trail |
| Settings | `/admin/settings` | Landing branding, AI, security options; reset helpers |
| Profile | `/admin/profile` | Admin profile |

Administrators **cannot** approve risk reports, publish mitigation as owners, or override RMO/President workflow decisions.

Operational data lives mainly in `docker/web/data/store.json` (Docker volume). Attachment metadata: PostgreSQL; files: MinIO/S3.

## End-to-end workflow (current)

1. Reporter creates a full 5W1H report with evidence and submits.
2. AI assists classification/routing; ticket is **assigned** to a department.
3. Department Head accepts (or rejects/reassigns); builds action plan.
4. Low/Moderate → reporter implements; High/Critical → President reviews the plan.
5. Reporter implements published plan and submits an accomplishment.
6. Department closes Low/Moderate after accomplishment; High/Critical go to President final decision.
7. RMO monitors organization-wide and may reopen closed tickets; Executive views High/Critical oversight.

See [Architecture](ARCHITECTURE.md) for statuses and design notes.

## Security notes

- Seed credentials are for **development only**.
- Set a strong `SESSION_SECRET` in `.env` for shared/production deployments.
- Sessions expire after 8 hours (cookie `maxAge`).

## Implementation files

| Path | Purpose |
|------|---------|
| `docker/web/config/roles.js` | Role registry (labels, paths, assignable) |
| `docker/web/config/users.js` | Seed accounts |
| `docker/web/config/tickets.js` | Statuses and workflow constants |
| `docker/web/server.js` | HTTP routes |
| `docker/web/lib/auth.js` | Session guards |
| `docker/web/lib/tickets.js` | Ticket CRUD and transitions |
| `docker/web/lib/templates/*.js` | Role consoles (supervisor, dept-head, officer, president, executive, admin) |

## Rebuild after code changes

```powershell
docker compose -f docker/compose.yml -f docker/compose.override.yml up --build -d web
```
