# Helpdesk API reference (v1)

Base URL: `/api/v1`. JSON in and out. The source of truth for request shapes is the Zod schemas in
`backend/src/modules/*/*.schemas.js`. Every schema is **strict**, so unknown fields return 400.

## Conventions

**Authentication.** Send `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes. When one
expires, call `POST /auth/refresh`. The browser sends the `hd_rt` cookie automatically.

**Request id.** Every response carries `X-Request-Id`. A well-formed incoming value (`[A-Za-z0-9._-]{1,64}`)
is echoed back; otherwise the server generates one. It also appears in error bodies and in logs.

**Single resources** are returned as the bare object. **Lists** look like this:
```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 } }
```
`page` ≥ 1 (default 1). `pageSize` is 1–100 (default 20).

**Errors** always have this shape:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "body.title", "message": "must be at least 3 characters" }],
    "requestId": "3f1c…"
  }
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid/unknown params, query or body; malformed JSON; invalid assignee |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token, wrong credentials, deactivated user, invalid refresh |
| 403 | `FORBIDDEN` | Role not allowed; self role/status change; deactivated account at login; CSRF header/origin check |
| 404 | `NOT_FOUND` | Unknown route/resource, **or a ticket you are not allowed to see** |
| 409 | `EMAIL_TAKEN` · `INVALID_STATUS_TRANSITION` · `TICKET_NOT_EDITABLE` · `TICKET_CLOSED` | State conflicts |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 100 KB |
| 429 | `RATE_LIMITED` | Too many auth requests. The response includes the `RateLimit` / `RateLimit-Policy` headers (IETF draft-8) |
| 500 | `INTERNAL` | Unexpected error (details are logged, never returned) |

## Objects

```jsonc
// User
{ "id": "uuid", "email": "alice@example.com", "name": "Alice", "role": "USER|ADMIN",
  "isActive": true, "createdAt": "ISO-8601", "updatedAt": "ISO-8601" }

// Ticket
{ "id": "uuid", "title": "VPN down", "description": "…", "priority": "LOW|MEDIUM|HIGH",
  "status": "OPEN|IN_PROGRESS|RESOLVED|CLOSED",
  "creator": { "id": "uuid", "name": "Alice" },
  "assignee": { "id": "uuid", "name": "Ada" } | null,
  "resolvedAt": "ISO-8601" | null, "closedAt": "ISO-8601" | null,
  "createdAt": "ISO-8601", "updatedAt": "ISO-8601" }

// Comment
{ "id": "uuid", "body": "…", "author": { "id": "uuid", "name": "Ada", "role": "ADMIN" }, "createdAt": "ISO-8601" }

// Ticket event (audit trail)
{ "id": "uuid", "type": "CREATED|STATUS_CHANGED|ASSIGNEE_CHANGED",
  "fromValue": "OPEN" | "<userId>" | null, "toValue": "IN_PROGRESS" | "<userId>" | null,
  "fromUser": { "id", "name" } | null,   // ASSIGNEE_CHANGED only
  "toUser":   { "id", "name" } | null,   // ASSIGNEE_CHANGED only
  "actor": { "id": "uuid", "name": "Ada" }, "createdAt": "ISO-8601" }
```

## Auth

| Method & path | Auth | Body | Success |
|---|---|---|---|
| `POST /auth/register` | public · rate-limited (10/15 min) | `{ email, name (1–100), password (12–128) }` | **201** `{ user, accessToken }` + `Set-Cookie: hd_rt` |
| `POST /auth/login` | public · rate-limited (10/15 min) | `{ email, password }` | **200** `{ user, accessToken }` + cookie |
| `POST /auth/refresh` | cookie + `X-Requested-With: fetch` · rate-limited (60/15 min) | — | **200** `{ user, accessToken }` + **rotated** cookie |
| `POST /auth/logout` | cookie + `X-Requested-With: fetch` | — | **204**; revokes the session family, clears the cookie |
| `GET /auth/me` | Bearer | — | **200** `{ user }` |

- Emails are trimmed and lowercased. Registration always creates a `USER`.
- A wrong password and an unknown email return the same 401 message.
- If `Origin` is present on refresh/logout, it must be in `CORS_ORIGINS`.
- Replaying a refresh token that was already rotated revokes the whole family, so every session from that login must log in again.

## Tickets

| Method & path | Who | Input | Success |
|---|---|---|---|
| `GET /tickets` | any (USER: own only) | query below | **200** list of Ticket |
| `POST /tickets` | any | `{ title (3–200), description (1–10000), priority? = MEDIUM }` | **201** Ticket |
| `GET /tickets/:id` | owner · ADMIN | — | **200** Ticket |
| `PATCH /tickets/:id` | owner while `OPEN` · ADMIN unless `CLOSED` | `{ title?, description?, priority? }` (≥ 1 field) | **200** Ticket |
| `PATCH /tickets/:id/status` | ADMIN | `{ status }` | **200** Ticket |
| `PATCH /tickets/:id/assignee` | ADMIN | `{ assigneeId: uuid \| null }` | **200** Ticket |

**List query:** `page`, `pageSize`, `status` and `priority` (repeatable or comma-separated:
`?status=OPEN&status=IN_PROGRESS` or `?status=OPEN,IN_PROGRESS`), `q` (case-insensitive title search;
`%`/`_` are matched literally), `assigneeId` (`uuid` or `unassigned`), and
`sort` ∈ `createdAt | -createdAt (default) | updatedAt | -updatedAt | priority | -priority`.

**Status transitions** (anything else → 409 `INVALID_STATUS_TRANSITION`):

```
OPEN ──▶ IN_PROGRESS ──▶ RESOLVED ──▶ CLOSED (terminal)
  │         ▲   │            │
  │         └───┘ (reopen)   └──▶ IN_PROGRESS (reopen)
  └──────────────────────────────▶ CLOSED
IN_PROGRESS ──▶ OPEN
```
Moving to `RESOLVED` sets `resolvedAt`; reopening clears it. Moving to `CLOSED` sets `closedAt`.

**Assignee rules:** the assignee must be an active ADMIN, otherwise the response is 400. `CLOSED` tickets can't be reassigned (409).
Setting the same assignee again is a no-op and records no event.

**Edit rules:** a USER can edit only while the ticket is `OPEN`. An ADMIN can edit any ticket that isn't `CLOSED`. Otherwise the response is 409 `TICKET_NOT_EDITABLE`.

## Comments & history

| Method & path | Who | Input | Success |
|---|---|---|---|
| `GET /tickets/:id/comments` | owner · ADMIN | `page`, `pageSize` (oldest first) | **200** list of Comment |
| `POST /tickets/:id/comments` | owner unless `CLOSED` · ADMIN | `{ body (1–5000, trimmed) }` | **201** Comment |
| `GET /tickets/:id/events` | owner · ADMIN | — | **200** `{ data: TicketEvent[] }` (oldest first) |

## Users (ADMIN only)

| Method & path | Input | Success |
|---|---|---|
| `GET /users` | `page`, `pageSize`, `q` (name/email), `role`, `isActive=true\|false` | **200** list of User (sorted by name) |
| `PATCH /users/:id/role` | `{ role }` | **200** User. Changing your own role returns 403 |
| `PATCH /users/:id/status` | `{ isActive }` | **200** User. Deactivation revokes all refresh tokens. Changing your own status returns 403 |

## Health

| Path | Meaning |
|---|---|
| `GET /healthz` (also `/api/v1/healthz`) | Liveness: 200 `{ "status": "ok" }` whenever the process is up |
| `GET /readyz` (also `/api/v1/readyz`) | Readiness: 200 when the DB answers `SELECT 1`; **503** if the DB is down or the server is shutting down |

## Example session

```bash
API=http://localhost:3000/api/v1
TOKEN=$(curl -s -c jar -X POST $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"…"}' | node -pe 'JSON.parse(fs.readFileSync(0)).accessToken')

curl -s "$API/tickets?status=OPEN&sort=-priority" -H "Authorization: Bearer $TOKEN"
curl -s -X POST $API/tickets -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Laptop will not boot","description":"Black screen after logo","priority":"HIGH"}'
# The refresh cookie is Secure; curl (like browsers) still sends it to http://localhost
curl -s -b jar -c jar -X POST $API/auth/refresh -H 'X-Requested-With: fetch'
```
