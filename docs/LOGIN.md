# Login and built-in accounts (development)

The web application provides a minimalist side-panel login page at `/login`. Authentication is session-based (cookie) until the Laravel API implements Sanctum/JWT.

## Access URL

| Environment | URL |
|-------------|-----|
| Docker (default) | http://localhost:8080/login |
| Web container direct | http://localhost:3000/login (internal) |

## Built-in credentials

| Username | Password | Role |
|----------|----------|------|
| `personnel` | `a3c2026` | Department Supervisor |
| `rm-officer` | `a3c2026` | Risk Management Officer |
| `audit-officer` | `a3c2026` | Audit Officer |
| `executive` | `a3c2026` | Executive |
| `admin` | `a3c1993` | IT Administrator (user/role management) |

Additional roles (e.g. **Employee**) can be assigned when creating accounts in the admin console.

Usernames are case-insensitive at login.

## Administrator capabilities

Sign in as `admin` to open the **IT Administration** console at http://localhost:8080/admin:

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/admin` | Summary and quick links |
| Accounts | `/admin/accounts` | Create accounts, assign roles, delete user-created accounts |
| Credentials log | `/admin/logs/credentials` | Sign-in and account change history |
| Report history | `/admin/logs/reports` | Risk ticket submission history (empty until supervisors submit reports) |

User data is stored in `docker/web/data/store.json` (persisted via Docker volume in development).

## Department Supervisor

Sign in as `personnel` / `a3c2026` to open the **Department Supervisor** console at http://localhost:8080/supervisor:

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/supervisor` | Summary stats and quick links |
| My tickets | `/supervisor/tickets` | All risk reports you submitted |
| New report | `/supervisor/tickets/new` | Create a 5W1H risk report with evidence references |
| Ticket detail | `/supervisor/tickets/:ref` | View, edit drafts, submit, add evidence, submit accomplishments |
| Action required | `/supervisor/actions` | Tickets needing implementation or revision |
| Accomplishments | `/supervisor/accomplishments` | History of accomplishment reports |

Submitted tickets appear in the IT Administrator **Report history** log (`/admin/logs/reports`).

**My Tickets (draft CRUD):** Open `/supervisor/tickets` to edit or delete **Draft** reports before submission. Submitted tickets are view-only.

**Evidence files:** Uploaded PDF/PNG/JPG files are stored on disk at `docker/web/uploads/` (Docker volume `/app/uploads`), not inside `store.json`. Each ticket links to its files by ticket reference (e.g. `RISK-2026-00001/`).

## Risk Management Officer

Sign in as `rm-officer` / `a3c2026` to open the **Risk Management Officer** console at http://localhost:8080/officer:

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/officer` | Dashboard stats and quick links |
| Review queue | `/officer/review` | Risk reports awaiting initial validation (Under RMO Review) |
| Final validation | `/officer/final-validation` | Accomplishment reports awaiting effectiveness validation |
| Implementation monitoring | `/officer/monitoring` | Tickets with approved mitigation in progress |
| All tickets | `/officer/tickets` | Organization-wide submitted tickets |
| Ticket detail | `/officer/tickets/:ref` | Review report, accept/reject, or final close/return |

Workflow (per architecture): validate submitted reports (accept with mitigation plan or return for revision); after department implementation and accomplishment submission, perform final validation and close or return for further work.

When the RMO accepts a report and defines a mitigation solution, the ticket moves to **Under Audit Review** and is routed to the Audit Officer (see below) before any implementation begins.

Officer actions are recorded in the IT Administrator **Report history** log (`/admin/logs/reports`).

## Audit Officer

Sign in as `audit-officer` / `a3c2026` to open the **Audit Officer** console at http://localhost:8080/audit:

| Screen | URL | Purpose |
|--------|-----|---------|
| Overview | `/audit` | Dashboard stats and quick links |
| Audit queue | `/audit/review` | Mitigation solutions awaiting audit review (Under Audit Review) |
| All tickets | `/audit/tickets` | Organization-wide submitted tickets (read-only) |
| Ticket detail | `/audit/tickets/:ref` | Review the RMO solution, then approve or return to RMO |

Workflow (per architecture step 4): the Audit Officer independently reviews the mitigation solution defined by the RMO **before** the department implements it.

- **Approve** — confirm the implementation due date and release the ticket for implementation (status becomes **Implementation Required**).
- **Return to RMO** — record audit notes explaining why the solution is insufficient; the ticket returns to the RMO review queue (**Returned by Audit**) for a revised solution, which loops back through audit.

Audit actions are recorded in the IT Administrator **Report history** log (`/admin/logs/reports`).

## Security notes

- Credentials are defined in [`docker/web/config/users.js`](../docker/web/config/users.js) for development only.
- **Do not use these passwords in production.** Replace with database-backed auth and strong secrets.
- Set `SESSION_SECRET` in `.env` for production deployments.
- Sessions expire after 8 hours (cookie `maxAge`).

## Implementation files

| Path | Purpose |
|------|---------|
| `docker/web/server.js` | Routes: `/login`, `/dashboard`, `/logout`, `/supervisor`, `/officer`, `/audit`, `/admin` |
| `docker/web/lib/templates/officer.js` | Risk Management Officer HTML templates |
| `docker/web/lib/templates/audit.js` | Audit Officer HTML templates |
| `docker/web/config/users.js` | Account definitions |
| `docker/web/public/css/login.css` | Login and dashboard styles |
| `docker/web/lib/auth.js` | Session guards and authentication |
| `docker/web/lib/templates.js` | HTML templates |

## Rebuild after changes

```powershell
docker compose -f docker/compose.yml -f docker/compose.override.yml up --build -d web
```
