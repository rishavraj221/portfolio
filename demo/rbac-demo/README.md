# rbac-demo

A working clone of the multi-tenant RBAC service described in
[projects/rbac.html](../../projects/rbac.html), rebuilt from scratch. Full
write-up: [system-design/rbac-service.html](../../system-design/rbac-service.html).

Fastify + TypeScript + Postgres + Redis, picked independently of the other
demos in this repo (see the system-design page for why) rather than reused
from `chat-demo` or `media-service`.

## Status

Full fidelity to the write-up, verified end to end: login, refresh rotation
with reuse-detection, RS256 JWT + JWKS, client-credentials grant on a
separate audience, central `POST /v1/authorize` with resource-level checks
(project membership, not just role), policy-version revocation (tested live:
an admin revoking a role in one tab flips another open session's badge to
"stale" and forces a silent token refresh within one poll interval), and a
tenant-isolation-enforcing repo layer with tests seeding two tenants per case.

## Local dev

```
docker compose up --build
```

- Backend: `http://localhost:4000`
- UI: `http://localhost:5174`

The backend container runs migrations and a seed script on boot (idempotent
— safe to restart). Seeded accounts, all with password `password123`:

| user | role | project |
|---|---|---|
| `admin@acme.test` | Admin | -- |
| `alice@acme.test` | Approver | Project Alpha |
| `bob@acme.test` | Approver | Project Beta |
| `carol@acme.test` | Viewer | -- |

Alice and Bob hold the identical `Approver` role and both have
`document:approve` in their token. Try approving each other's project's
document from the "Protected app" tab — the button shows either way (a local
check on the permission alone), but the actual approve call is a central
`POST /v1/authorize`, which additionally checks project membership and denies
the one they're not on. That gap between the coarse and the resource-level
check is the whole point of the split described in the write-up.

## Layout

```
backend/    Fastify + TS: auth, authorize, admin, and demo routes; migrations; tests
ui/         React + Vite: admin console + a protected demo app with a live decision log
infra/      EKS/RDS/ElastiCache Terraform, production-shaped but not applied
```
