# Helpdesk Ticketing System

An internal helpdesk: users raise tickets, admins triage, assign and resolve them.
Every status and assignee change is recorded in an audit trail.

| Part | Stack | Status |
|---|---|---|
| `backend/` | Node.js 24 LTS, Express 5, Zod, Drizzle ORM, PostgreSQL 16 | ✅ Phase 2 |
| `frontend/` | React 19 (Vite), React Router 7, TanStack Query, Zustand, React Hook Form + Zod, served by nginx | ✅ Phase 3 |
| `infra/` | Azure Bicep (Container Apps, PostgreSQL Flexible Server, ACR, Key Vault) + OIDC deploy workflow | ✅ Phase 4 (runbook-driven; see [`docs/DEPLOY.md`](docs/DEPLOY.md)) |

The approved design (data model, API contract, phases) is in [`docs/PLAN.md`](docs/PLAN.md).
The accessibility audit is in [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md).
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
npm run dev                     # API on http://localhost:3000  (auto-restarts on change)

# in a second terminal
cd helpdesk-app/frontend
npm install
npm run dev                     # http://localhost:5173 (Vite proxies /api to :3000)
```

Sign in with `admin@example.com` or `alice@example.com` and the seed passwords you set in `.env`.

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
docker compose up --build       # db → migrate (one-shot) → api → web on http://localhost:8080
docker compose exec -e SEED_ADMIN_PASSWORD=... -e SEED_USER_PASSWORD=... api node src/db/seed.js  # optional sample data
```

The `api` container only starts after the `migrate` job exits successfully. The API is not published to
the host: the browser talks only to the `web` container (nginx), which serves the app and proxies `/api`.

## Deploying to Azure

Follow [`docs/DEPLOY.md`](docs/DEPLOY.md): a numbered Cloud Shell runbook covering preview (what-if), secrets generated into
Key Vault, GitHub OIDC setup, verification with curl, rollback and teardown. Costs are in
[`docs/COSTS.md`](docs/COSTS.md) (about $25/month, about $9 for a 10-day trial).

- **Resources:** one resource group, `helpdesk-rg`, containing:
  - Container Apps: the public nginx web app and an internal-only API
  - a migration job
  - PostgreSQL Flexible Server B1ms
  - Container Registry Basic, Key Vault, Log Analytics
- **Templates (`infra/`):** `core.bicep` then `database.bicep`, both run by you, then `apps.bicep`, run by the workflow.
- **Deploys:** push a `helpdesk-v*` tag. `.github/workflows/helpdesk-deploy.yml` logs in with OIDC (no stored Azure secrets),
  pushes the images, runs migrations as a gated step, then updates the API and web apps.

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

In `frontend/`: `npm run dev`, `npm test` (Vitest + Testing Library + MSW + axe-core), `npm run lint`
(includes `jsx-a11y`), `npm run build`.

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

## Frontend

| Route | Who | What |
|---|---|---|
| `/login`, `/register` | public | Sign in / sign up (autocomplete hints, show-password toggle, focused error summary) |
| `/tickets` | all | List with status/priority/title filters and sort, all kept in the URL; admins get quick views (Unassigned, Assigned to me…) and land on open + in-progress tickets sorted by priority |
| `/tickets/new`, `/tickets/:id/edit` | owner while OPEN · admin until CLOSED | Shared form; input is kept on server errors |
| `/tickets/:id` | owner · admin | Details, comments (added instantly, rolled back if the save fails), history timeline; admins get the status control (only valid next statuses; closing asks for confirmation) and an assignee picker with **Assign to me** |
| `/admin/users` | admin | Search/filter users, change role (with Undo), deactivate (with confirmation) and reactivate |

**How it fits together**

- **Session:**
  - The access token lives only in memory (Zustand); the refresh token is an httpOnly cookie.
  - On page load, `AuthBootstrap` calls `/auth/refresh` to restore the session.
  - `src/api/http.js` retries once after a 401, sharing a single refresh between concurrent requests and serialising refreshes across tabs with the Web Locks API ([ADR-003](docs/adr/003-token-model.md)).
- **Server state:** TanStack Query. Mutations update the ticket cache and invalidate lists and history.
- **Design system:** three-tier CSS custom-property tokens (`src/styles/tokens.css`). Dark mode redefines only the semantic tokens, and components never use raw colours.
- **Copy:** every user-facing message lives in `src/domain/copy.js`, and tests assert those exact strings.
- **Production:** nginx (unprivileged, port 8080) serves the build with a strict CSP (`script-src 'self'`, no inline styles) and security headers, caches hashed assets immutably, and proxies `/api`.

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

`frontend/src/**/*.test.*` holds 51 tests. They cover the API client (single-flight refresh, error parsing), the
login flow, route guards, role-aware navigation, list filters and empty/error states, create-form validation and
server-error mapping, the admin status/assignee panel, the users page (Undo, confirmation), and axe checks on
5 screens.

`backend/test/` holds 138 tests (about 92% statement coverage):

- **Unit:** every status-transition pair, env validation, token helpers, pagination.
- **Integration (Supertest + real PostgreSQL):** auth lifecycle including refresh-token reuse,
  a route × role RBAC matrix (401/403), object-level 404s, status transitions with audit events,
  assignment rules, comments, admin user management, health, CORS and error shapes.

The test setup drops and re-migrates the test schema on every run. It refuses to run unless the
database name ends in `_test`.

## Known limitations (frontend)

- The JS bundle is about 156 KB gzipped (React, Router, TanStack Query and Zod in one chunk). Route-level code splitting would cut the first load.
- Ticket lists don't live-update: they refresh after your own changes and when the tab regains focus (if the data is older than 15 s). There is no polling or push.
- Users-page filters are kept in component state, not in the URL (ticket filters are in the URL).
- Accessibility was checked with automated tools and keyboard testing, but not with a real screen reader. See [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md).
- English only; no i18n framework.

## Known limitations (backend)

- The rate-limit counters are in-memory, so with several replicas each one counts separately. A shared store (e.g. Redis) would fix this.
- Demoting an admin leaves them as the assignee on existing tickets.
- There is no password-reset or email-verification flow.
- `drizzle-kit` (dev-only) pulls in an esbuild version with a moderate advisory that only
  affects its dev server, which we never run. The production dependency audit is clean.
