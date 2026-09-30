# Helpdesk Ticketing System — Phase 1 Plan (architecture, data model, API contract)

## Context
Build a production-grade internal helpdesk (tickets, comments, audit trail, RBAC) inside a new
`helpdesk-app/` folder of the public `ai-projects` repo, on branch `feat/helpdesk-app`, without touching
`concept-lab/`. Delivered in 5 phases with a review stop after each. This document is the Phase 1
deliverable; no code is written until you approve it.

**Environment findings (verified):** Node 22.22 + npm 10.9 + pnpm are installed. PostgreSQL 16 is
installed (cluster exists but stopped — I'll start it for tests). The Docker CLI is present, but **no Docker
daemon is running**, so `docker compose up` / image builds probably can't run here. I'll try `dockerd`
once in Phase 2; if that fails, I'll check Dockerfiles/compose with `docker compose config` only, and CI
will do the real image builds. No Azure CLI or login. No root `.gitignore` or `.github/` exists yet.
`concept-lab/` uses pnpm, ESLint 9 flat config and Prettier. I'll leave it alone.

**Skills:** None of the installed skills fits Phase 1. Plan: run `code-review` at the end of Phases 2
and 3, and `security-review` in Phase 5. I'll tell you each time I use one.

## Key decisions
| Topic | Choice | Why |
|---|---|---|
| Language | JavaScript (ESM) + JSDoc on both sides | Matches your stack wording and concept-lab; say so if you want TypeScript |
| ORM/migrations | **Drizzle** (drizzle-orm + drizzle-kit, `pg` driver) | SQL-first, and every query is parameterized. No Prisma engine binary, so Docker images stay small and there's no binary download through the proxy/CI. drizzle-kit writes **plain `.sql` migrations** you can review in PRs. In prod, `drizzle-orm/migrator` runs them from a tiny script (drizzle-kit isn't in the runtime image) |
| Package mgmt | npm, separate `frontend/` and `backend/` packages each with its own lockfile; a small `helpdesk-app/package.json` only for husky/lint-staged/prettier | Docker build contexts stay simple; no pnpm needed for Azure newcomers |
| Node | Node 24 LTS in Docker/CI, `engines >=22` (local is 22) | |
| Same-origin design | Frontend nginx container serves the SPA **and reverse-proxies `/api` to the API** (Vite dev proxy does the same locally) | `*.azurecontainerapps.io` is on the Public Suffix List, so two apps there count as different *sites*. Same-origin lets the refresh cookie be `SameSite=Strict`, removes most CORS risk, and lets the API use **internal-only ingress** (not reachable from the internet) |
| Tokens | Access JWT (HS256, 15 min, memory only). Refresh = opaque 256-bit random value, 7-day, rotated on every use, stored as SHA-256 hash, grouped by `family_id` with **reuse detection** (reusing a revoked token revokes the whole family) | High-entropy token → a fast hash is fine for it; passwords get **argon2id** |
| Cookie | `hd_rt`; `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` | `/refresh` and `/logout` also need header `X-Requested-With: fetch` + an Origin allowlist check (CSRF defence in depth) |
| Per-request auth | JWT verified, then the user row is loaded (role, `is_active`) | Role changes/deactivation take effect immediately rather than after 15 min; cost is 1 indexed query |
| Object-level authz | Other users' tickets return **404** (not 403) | Doesn't reveal that the ticket exists |
| Frontend | React 19 + Vite, React Router (data router), TanStack Query (server state), Zustand (auth: access token + user in memory), RHF + Zod, CSS Modules | No UI kit → fewer dependencies; accessible primitives written by hand |
| Tests | Vitest + Supertest against a **real Postgres** test DB (local cluster here, a `postgres` service in CI); frontend Vitest + RTL + MSW | |

## Monorepo layout
```
.github/workflows/helpdesk-ci.yml       # paths: helpdesk-app/**, the workflow file itself
.github/workflows/helpdesk-deploy.yml   # Phase 4; OIDC; workflow_dispatch (+ push to main later)
helpdesk-app/
  .gitignore  .env.example              # FIRST commit
  CLAUDE.md  README.md  package.json    # root tooling: husky, lint-staged, prettier
  .husky/pre-commit                     # cd helpdesk-app && lint-staged (only helpdesk-app files)
  docker-compose.yml                    # db, migrate (one-shot), api, web
  docs/DEPLOY.md  docs/COSTS.md  docs/API.md
  backend/
    Dockerfile  .dockerignore  package.json  eslint.config.js  vitest.config.js  drizzle.config.js
    drizzle/                            # generated SQL migrations + meta
    src/
      server.js                         # listen + graceful shutdown (SIGTERM/SIGINT)
      app.js                            # express app factory (used by tests)
      config/env.js                     # zod-validated env, fail fast
      db/{client.js,schema.js,migrate.js,seed.js}
      lib/{errors.js,logger.js,password.js,tokens.js,pagination.js,cookies.js}
      middleware/{requestContext.js,authenticate.js,requireRole.js,validate.js,rateLimiters.js,errorHandler.js,notFound.js}
      domain/ticketStatus.js            # transition table, pure
      modules/{auth,tickets,comments,users,health}/{*.routes.js,*.service.js,*.schemas.js}
    test/{setup/,unit/,integration/}
  frontend/
    Dockerfile  nginx/default.conf.template  package.json  vite.config.js  eslint.config.js
    src/
      main.jsx  app/{router.jsx,providers.jsx,queryClient.js}
      api/{http.js,auth.js,tickets.js,users.js}   # fetch wrapper: bearer + single-flight refresh on 401
      stores/authStore.js
      features/auth/  features/tickets/  features/users/
      components/{layout/,ui/}  styles/
      test/
  infra/                                # Phase 4
    main.bicep  main.parameters.json  modules/{logs,identity,acr,keyvault,postgres,containerapps-env,containerapp,migration-job}.bicep
```
Layering: `routes` (HTTP, validation, role gate) → `service` (business rules, object-level authz,
transactions) → Drizzle. Services throw typed `AppError`s; one error handler formats them.

## Data model (ERD)
```
users 1───* tickets (creator_id)          users 1───* refresh_tokens
users 1───* tickets (assignee_id, null)   tickets 1───* comments *───1 users (author_id)
tickets 1───* ticket_events *───1 users (actor_id)

users
  id uuid PK default gen_random_uuid()
  email varchar(254) NOT NULL  -- stored lowercased; UNIQUE
  name varchar(100) NOT NULL
  password_hash text NOT NULL             -- argon2id
  role user_role NOT NULL default 'USER'  -- enum ADMIN|USER
  is_active boolean NOT NULL default true
  created_at, updated_at timestamptz NOT NULL default now()

refresh_tokens
  id uuid PK; user_id uuid FK→users ON DELETE CASCADE
  token_hash char(64) UNIQUE NOT NULL; family_id uuid NOT NULL
  expires_at timestamptz NOT NULL; revoked_at timestamptz NULL; replaced_by_id uuid NULL
  created_at timestamptz; user_agent varchar(255) NULL
  idx (user_id), idx (family_id)

tickets
  id uuid PK; title varchar(200) NOT NULL; description text NOT NULL (≤10k, validated)
  priority ticket_priority NOT NULL default 'MEDIUM'   -- LOW|MEDIUM|HIGH
  status ticket_status NOT NULL default 'OPEN'          -- OPEN|IN_PROGRESS|RESOLVED|CLOSED
  creator_id uuid FK→users ON DELETE RESTRICT
  assignee_id uuid NULL FK→users ON DELETE SET NULL
  created_at, updated_at, resolved_at NULL, closed_at NULL (timestamptz)
  idx (creator_id, created_at desc), (assignee_id), (status), (priority), GIN trigram (title)  -- pg_trgm for ILIKE search

comments
  id uuid PK; ticket_id FK→tickets ON DELETE CASCADE; author_id FK→users RESTRICT
  body text NOT NULL (1–5000); created_at timestamptz; idx (ticket_id, created_at)

ticket_events  (audit log, written in the SAME transaction as the change)
  id uuid PK; ticket_id FK CASCADE; actor_id FK→users RESTRICT
  type ticket_event_type NOT NULL  -- CREATED|STATUS_CHANGED|ASSIGNEE_CHANGED
  from_value text NULL; to_value text NULL; created_at timestamptz; idx (ticket_id, created_at)
```
**Status transitions** (checked on the server, `409 INVALID_STATUS_TRANSITION` otherwise, ADMIN only):
`OPEN→IN_PROGRESS|CLOSED`, `IN_PROGRESS→OPEN|RESOLVED`, `RESOLVED→IN_PROGRESS|CLOSED`, `CLOSED→∅` (terminal).
Sets `resolved_at`/`closed_at` accordingly. Setting status to the current value → 409.

**Business-rule defaults (tell me if any are wrong):**
- A USER can see all of their own tickets (any status), but can **edit title/description/priority only while status is OPEN**. They can comment on their own tickets unless the ticket is CLOSED.
- Only ADMINs can be assignees (the assignee must be an active ADMIN). ADMINs can edit fields on any non-CLOSED ticket.
- Public register always creates a `USER`; only admins can promote. An admin can't demote or deactivate themselves (prevents lockout).
- Deactivating a user revokes all of their refresh tokens. Inactive users can't log in, and their current access token stops working on the next request.
- Tickets aren't deleted (none of the requirements ask for it).
- The ticket history (events) is visible to anyone who can see the ticket.

## API contract (`/api/v1`, JSON)
**Error shape (always):** `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "path": "title", "message": "..." }], "requestId": "..." } }`
Codes: `VALIDATION_ERROR 400`, `UNAUTHENTICATED 401`, `FORBIDDEN 403`, `NOT_FOUND 404`, `CONFLICT/EMAIL_TAKEN/INVALID_STATUS_TRANSITION 409`, `RATE_LIMITED 429`, `INTERNAL 500`.
**List shape:** `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 } }` — `page≥1`, `pageSize` 1–100 (default 20).
Every request gets an `X-Request-Id` header, echoed back and included in logs.

| Method & path | Auth | Body / query | Response |
|---|---|---|---|
| POST `/auth/register` | public, rate-limited | `{email, password(12–128), name}` | 201 `{user, accessToken}` + cookie |
| POST `/auth/login` | public, rate-limited | `{email, password}` | 200 `{user, accessToken}` + cookie; the same 401 for a wrong email or wrong password |
| POST `/auth/refresh` | cookie + `X-Requested-With`, rate-limited | — | 200 `{user, accessToken}` + rotated cookie |
| POST `/auth/logout` | cookie + `X-Requested-With` | — | 204; revokes the token family and clears the cookie |
| GET `/auth/me` | any | — | 200 `{user}` |
| GET `/tickets` | any (USER sees only own tickets) | `page, pageSize, status (repeatable), priority (repeatable), q (title search), assigneeId\|"unassigned"` (admin), `sort=createdAt\|-createdAt\|updatedAt\|-updatedAt\|priority` | 200 list of tickets with `creator{id,name}`, `assignee{id,name}\|null` |
| POST `/tickets` | any | `{title, description, priority?}` | 201 ticket (+ CREATED event) |
| GET `/tickets/:id` | owner or ADMIN | — | 200 ticket |
| PATCH `/tickets/:id` | owner (OPEN only) or ADMIN (not CLOSED) | `{title?, description?, priority?}` (at least 1 field) | 200 ticket |
| PATCH `/tickets/:id/status` | ADMIN | `{status}` | 200 ticket (+ STATUS_CHANGED event) |
| PATCH `/tickets/:id/assignee` | ADMIN | `{assigneeId: uuid\|null}` | 200 ticket (+ ASSIGNEE_CHANGED event) |
| GET `/tickets/:id/comments` | owner or ADMIN | `page, pageSize` (oldest first) | 200 list |
| POST `/tickets/:id/comments` | owner (not CLOSED) or ADMIN | `{body}` | 201 comment |
| GET `/tickets/:id/events` | owner or ADMIN | — | 200 `{data:[...]}` |
| GET `/users` | ADMIN | `page, pageSize, q (name/email), role, isActive` | 200 list (never includes password_hash) |
| PATCH `/users/:id/role` | ADMIN (not self) | `{role}` | 200 user |
| PATCH `/users/:id/status` | ADMIN (not self) | `{isActive}` | 200 user |
| GET `/healthz` (at `/`, not versioned) | public | — | 200 `{status:"ok"}` (process only, no DB check) |
| GET `/readyz` | public | — | 200 when a DB ping succeeds; 503 when the DB is down or the app is shutting down |

Every endpoint validates `params`, `query` and `body` with Zod through `validate()` and uses `.strict()`
objects. Unknown fields → 400.

## Cross-cutting backend details
- `helmet` (strict CSP for the API), `cors` with an explicit `CORS_ORIGINS` allowlist and `credentials:true`, `express.json({limit:'100kb'})`, `app.set('trust proxy', 1)`, `x-powered-by` off.
- `express-rate-limit`: `/auth/login` & `/auth/register` 10/15 min per IP+route, `/auth/refresh` 60/15 min. The store is in-memory; with more than one replica each replica keeps its own count (documented limitation).
- `pino` + `pino-http`: JSON logs that redact `authorization`, `cookie`, `password`, and `set-cookie`; `pino-pretty` only in dev.
- `config/env.js`: `NODE_ENV, PORT, DATABASE_URL, JWT_ACCESS_SECRET(≥32 chars), ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, CORS_ORIGINS, COOKIE_SECURE, LOG_LEVEL, DB_SSL`. An invalid config exits with code 1 and a readable message.
- Graceful shutdown: on SIGTERM, flip `/readyz` to 503, `server.close()` with a 10 s timeout, `pool.end()`, then exit.
- Seed (`npm run db:seed`, idempotent): 1 admin + 3 users + ~12 tickets with comments/events. Passwords come from `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`. **The seed refuses to run when `NODE_ENV=production` unless `--force` is passed.** No real credentials are committed; `.env.example` has placeholders only.

## Frontend screens
`/login`, `/register` (public, redirect if logged in) · `/tickets` (filters: status/priority multi-select,
title search debounced, pagination, synced to URL search params) · `/tickets/new` · `/tickets/:id`
(detail, comments thread + form, history; admin panel: status select showing only valid next states,
assignee select) · `/tickets/:id/edit` · `/admin/users` (ADMIN route guard: role change, deactivate/reactivate
with confirm dialog) · 404 page. On app boot, the app calls `/auth/refresh` to restore the session from the cookie.
Every data view has explicit loading, empty and error (with retry) states. Layout is responsive, uses
semantic landmarks, labelled form controls, visible focus, `aria-live` for form errors, and meets AA contrast.
Tests: login flow, protected route redirect, role-aware nav, ticket list filters/empty state, create-ticket validation,
admin status control showing only allowed transitions.

## Handoff to a new session (you chose this, so the plugin skills load)
Once you approve, this session does only one thing: commit this plan verbatim as `helpdesk-app/docs/PLAN.md`
(`docs(helpdesk): add approved phase 1 plan`) and push it to `feat/helpdesk-app`. You then start a **new** session on
that branch and tell it to read `helpdesk-app/docs/PLAN.md` and begin Phase 2. It should use the plugin skills
`api-contract-forge`, `architecture` and `testing-strategy` in Phase 2; `modern-web-guidance`, `interaction-design`,
`ux-writing` and `accessibility-audit`/`accessibility-review` in Phase 3; `deploy-checklist` in Phase 4; and `code-review` at the end of each phase.
The new session should report each skill it uses.
The `.gitignore`/`.env.example`-first rule still applies to the first *code* commit. A Markdown doc contains no code or secrets.
The one exception is this plan: it lands under `helpdesk-app/docs/` before `.gitignore`, which is harmless.

## Phase breakdown (commit sequence, conventional commits)
**Phase 2 — Backend**
1. `chore(helpdesk): add .gitignore and .env.example` (first; ignores `.env*` except `.env.example`, node_modules, dist, coverage, `*.pem`, `.azure/`)
2. `chore(helpdesk): scaffold tooling` (root package.json, prettier, husky + lint-staged)
3. `feat(helpdesk-api): express app skeleton, env config, logging, errors, health`
4. `feat(helpdesk-api): drizzle schema and initial migration`
5. `feat(helpdesk-api): auth (register/login/refresh/logout) with rotating refresh tokens`
6. `feat(helpdesk-api): tickets, comments, audit events, status transitions`
7. `feat(helpdesk-api): admin user management`
8. `feat(helpdesk-api): seed script`
9. `test(helpdesk-api): unit + integration tests` (can be interleaved with 5–7)
10. `build(helpdesk): backend Dockerfile + docker-compose` · `ci(helpdesk): lint/test/build workflow` · `docs(helpdesk): README + CLAUDE.md (initial)`

**Phase 3 — Frontend:** scaffold → api client/auth store → auth pages + guards → tickets screens → admin users → tests → Dockerfile/nginx → CI job → docs.

**Phase 4 — Azure:** Bicep (user-assigned managed identity with AcrPull + Key Vault Secrets User; Log Analytics with a daily cap;
ACR Basic; Key Vault RBAC holding `jwt-access-secret`, `database-url`; PG Flexible **B1ms** Burstable, 32 GB, PG16,
public access + "allow Azure services" + TLS required (VNet costs more and is harder for a first deploy; noted as a trade-off);
Container Apps env on the consumption plan; `api` app with **internal** ingress and min replicas 0; `web` app with external ingress
and min replicas 0; a **Container Apps Job `migrate`** running the API image with `node src/db/migrate.js`).
Deploy workflow: OIDC `azure/login` → build & push images tagged with the git SHA → start the migrate job with the new image
and **wait; fail the deploy if the job fails** (the migrate script also takes a `pg_advisory_lock`; migrations must be backward-compatible,
using expand/contract) → update `api`, then `web` → smoke-test `/healthz` and `/api/v1/readyz` through the web URL.
DEPLOY.md: numbered Cloud Shell commands (RG, `az deployment group create`, Entra app + federated credential for
`repo:sujayweb3master/ai-projects:environment:production`, role assignments, `gh`/UI steps for the repo variables
`AZURE_CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID`, which are not secrets), budget alert, verification, `az postgres flexible-server stop`
(note: Azure restarts it automatically after 7 days), `az group delete`.
Rough monthly estimate (to be re-checked against the pricing pages in Phase 4): PG B1ms about $13 + 32 GB storage about $4, ACR Basic about $5,
Container Apps about $0–3 (the free grant covers scale-to-zero traffic), Key Vault <$0.10, Log Analytics about $0 (5 GB free, capped) → **about $22–25/mo,
and about $5–9/mo while the DB is stopped**. That fits a $200 budget for about 8 months or more.

**Phase 5 — Review:** run the `security-review` skill, a security checklist, known limitations, next steps.

## Verification (per phase)
- Phase 2: `npm run lint`, `npm test` (Vitest + Supertest against the local PG16 test DB; covers register/login/refresh rotation +
  reuse detection, logout, deactivated user, RBAC 401/403/404 boundaries, every allowed/forbidden status transition, pagination/filter/search,
  validation errors). Migrations applied to a fresh DB, then the seed run twice (idempotent). Server booted with `curl` checks of
  `/healthz`, `/readyz`, login → refresh cookie flow. Docker: real build if a daemon can be started, else `docker compose config` only, and I'll say which.
- Phase 3: `npm run lint`, `npm test`, `npm run build`; run API + Vite dev server and click through with Playwright/Chromium (screenshots).
- Phase 4: `az bicep build` is not available locally, so I'll try the `bicep` CLI via npm/binary and say what couldn't be verified. Workflows are linted with `actionlint` if I can install it.
- CI: path-filtered workflows, `defaults.run.working-directory`, Postgres service container for backend tests, image builds without pushing.
