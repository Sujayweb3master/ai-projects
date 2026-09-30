# Helpdesk Ticketing System

An internal helpdesk: users raise tickets, admins triage, assign and resolve them.
Every status and assignee change is recorded in an audit trail.

| Part | Stack | Status |
|---|---|---|
| `backend/` | Node.js 24 LTS, Express 5, Zod, Drizzle ORM, PostgreSQL 16 | ✅ Phase 2 |
| `frontend/` | React (Vite), React Router, TanStack Query, Zustand, RHF + Zod | ⏳ Phase 3 |
| `infra/` | Azure Bicep (Container Apps, PostgreSQL Flexible Server, ACR, Key Vault) | ⏳ Phase 4 |

The approved design (data model, API contract, phases) is in [`docs/PLAN.md`](docs/PLAN.md).
The full endpoint reference is in [`docs/API.md`](docs/API.md), and the decision records are in [`docs/adr/`](docs/adr/).

---

## Quick start (local, without Docker)

Prerequisites: Node.js ≥ 22 and PostgreSQL 16.

```bash
cd helpdesk-app
cp .env.example .env            # then edit: DB password, JWT_ACCESS_SECRET, seed passwords
npm install                     # root tooling + git pre-commit hook

# Create the databases (adjust the user/password to match .env)
createdb helpdesk && createdb helpdesk_test

cd backend
npm install
npm run db:migrate              # apply SQL migrations
npm run db:seed                 # 1 admin + 3 users + 12 tickets (dev only)
npm run dev                     # http://localhost:3000  (auto-restarts on change)
```

Try it:

```bash
curl localhost:3000/healthz
curl -X POST localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"<SEED_ADMIN_PASSWORD from .env>"}'
```

## Quick start (Docker Compose)

```bash
cd helpdesk-app
cp .env.example .env            # set POSTGRES_PASSWORD and JWT_ACCESS_SECRET at minimum
docker compose up --build       # db → migrate (one-shot) → api on http://localhost:3000
```

The `api` container only starts after the `migrate` job exits successfully.

## Commands (run in `backend/`)

| Command | What it does |
|---|---|
| `npm run dev` | Start API with `--watch`, loads `../.env` |
| `npm test` | Unit + integration tests (needs `DATABASE_URL_TEST`; DB name **must** end in `_test`) |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run db:generate` | Generate a new SQL migration from `src/db/schema.js` |
| `npm run db:migrate` | Apply pending migrations (takes a Postgres advisory lock) |
| `npm run db:seed` | Seed sample data; refuses `NODE_ENV=production` without `--force` |

From `helpdesk-app/`: `npm run format` / `npm run format:check` (Prettier).
A pre-commit hook (husky + lint-staged) lints and formats staged files under `helpdesk-app/` only.

## Configuration

All configuration comes from environment variables, validated with Zod at startup. If any
value is invalid, the process exits and lists every problem. See [`.env.example`](.env.example).

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | `postgres://user:pass@host:5432/db` |
| `DB_SSL` | `false` | `true` for Azure PostgreSQL (certificate verified) |
| `JWT_ACCESS_SECRET` | — | ≥ 32 chars; generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ACCESS_TOKEN_TTL` | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh-token lifetime |
| `CORS_ORIGINS` | *(empty)* | Comma-separated allowlist of browser origins |
| `COOKIE_SECURE` | `true` | Browsers accept Secure cookies on `http://localhost` |
| `TRUST_PROXY_HOPS` | `0` | Reverse proxies in front of the API. Keep 0 unless behind a proxy, or clients can spoof their IP |
| `LOG_LEVEL`, `PORT`, `DB_POOL_MAX` | `info`, `3000`, `10` | |

## Architecture

```
Browser ──HTTPS──▶ web (nginx: SPA + reverse proxy /api) ──▶ api (Express) ──▶ PostgreSQL
                    same origin → SameSite=Strict cookie      internal only
```

- **Layers:** `routes` (HTTP, Zod validation, role gate) → `service` (business rules,
  object-level authorization, transactions) → Drizzle ORM (parameterized SQL only).
- **Errors:** services throw typed `AppError`s, and a single error handler turns them into
  `{ "error": { code, message, details?, requestId } }`.
- **Audit trail:** `ticket_events` rows are written in the same transaction as the change they record.
- **Status machine:** `OPEN→IN_PROGRESS|CLOSED`, `IN_PROGRESS→OPEN|RESOLVED`,
  `RESOLVED→IN_PROGRESS|CLOSED`, `CLOSED` is terminal (`src/domain/ticketStatus.js`).

### Key decisions (details in [`docs/adr/`](docs/adr/))

1. **Drizzle over Prisma:** SQL-first, reviewable `.sql` migrations, no engine binary. ([ADR-001](docs/adr/001-drizzle-orm.md))
2. **Same-origin deployment:** nginx proxies `/api`, so the API never needs public ingress. ([ADR-002](docs/adr/002-same-origin-reverse-proxy.md))
3. **Token model:** 15-minute access JWT kept in memory, plus a rotating refresh token in an httpOnly cookie, stored hashed, with reuse detection. ([ADR-003](docs/adr/003-token-model.md))
4. **Per-request user load:** role changes and deactivation take effect on the very next request. ([ADR-004](docs/adr/004-per-request-user-load.md))

### Security controls

- Passwords are hashed with **argon2id** (OWASP parameters). Login returns an identical 401 for an unknown email and for a wrong password, and uses equalised timing.
- Refresh tokens are 256-bit random values, only their SHA-256 hash is stored, and they rotate on every use. Replaying an old token revokes the whole session family.
- `/auth/refresh` and `/auth/logout` also require the `X-Requested-With: fetch` header and an allow-listed `Origin` (CSRF defence in depth).
- RBAC middleware runs on every route. Other users' tickets return **404**, not 403.
- helmet (deny-all CSP for the JSON API), CORS with an explicit allowlist, a 100 KB body limit, and rate limiting on the auth routes.
- Every endpoint uses a strict Zod schema, so unknown fields are rejected.
- Structured pino logs with a request id. Authorization headers, cookies and passwords are redacted.
- `/healthz` (liveness) and `/readyz` (checks the DB; returns 503 while draining). On SIGTERM the server stops accepting connections, drains, closes the pool and exits.

## API overview

Base path `/api/v1`. Full reference: [`docs/API.md`](docs/API.md).

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| Tickets | `GET/POST /tickets` · `GET/PATCH /tickets/:id` · `PATCH /tickets/:id/status` 🔒 · `PATCH /tickets/:id/assignee` 🔒 |
| Comments & history | `GET/POST /tickets/:id/comments` · `GET /tickets/:id/events` |
| Users 🔒 | `GET /users` · `PATCH /users/:id/role` · `PATCH /users/:id/status` |
| Health | `GET /healthz` · `GET /readyz` (also under `/api/v1`) |

🔒 = ADMIN only.

## Testing

`backend/test/` holds 135 tests (about 92% statement coverage):

- **Unit:** every status-transition pair, env validation, token helpers, pagination.
- **Integration (Supertest + real PostgreSQL):** auth lifecycle including refresh-token reuse,
  a route × role RBAC matrix (401/403), object-level 404s, status transitions with audit events,
  assignment rules, comments, admin user management, health, CORS and error shapes.

The test setup drops and re-migrates the test schema on every run. It refuses to run unless the
database name ends in `_test`.

## Known limitations (backend)

- The rate-limit counters are in-memory, so with several replicas each one counts separately. A shared store (e.g. Redis) would fix this.
- Demoting an admin leaves them as the assignee on existing tickets.
- There is no password-reset or email-verification flow.
- `drizzle-kit` (dev-only) pulls in an esbuild version with a moderate advisory that only
  affects its dev server, which we never run. The production dependency audit is clean.
