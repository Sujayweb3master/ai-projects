# Industry Standards — Production Best Practices

These standards apply to both BUILD and ANALYZE modes. They're based on current (2025-2026) industry best practices from OWASP, RFC 9457, OpenAPI Initiative, and API governance guidelines.

Reference this file when running the compliance checklist (Step 0.6 in BUILD mode) or when flagging issues in ANALYZE mode.

---

## Standard 1: Error Format — RFC 9457 (Problem Details)

All error responses should follow RFC 9457 (supersedes RFC 7807). This is the industry standard for HTTP API errors because it gives clients a machine-readable error type, a human-readable explanation, and a trace ID for debugging — all in one consistent shape.

**Required error shape:**
```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Field 'email' must be a valid email address",
  "instance": "/invoices",
  "traceId": "abc-123-def",
  "errors": [
    { "field": "email", "message": "Must be a valid email", "code": "INVALID_FORMAT" }
  ]
}
```

**Required fields:** `type` (URI reference), `title` (human-readable), `status` (HTTP status code)
**Recommended fields:** `detail` (specific explanation), `instance` (request path), `traceId` (correlation ID)
**Optional extension:** `errors[]` (field-level validation details)

In BUILD mode: If the project already has a custom error format (like `{ success: false, message, error }`), use that format but recommend RFC 9457 as a comment. Forcing a migration mid-project causes more harm than good — respect existing conventions.

In ANALYZE mode: Flag non-RFC-9457 error responses as INFO (not CRITICAL), since many projects use custom formats successfully.

---

## Standard 2: API Versioning

Every API should have a versioning strategy. In BUILD mode, detect and follow the existing project's approach:

| Strategy | Pattern | When to Use |
|----------|---------|-------------|
| **URL path** (recommended) | `/api/v1/invoices` | Most common, clearest for consumers |
| **Header** | `Accept: application/vnd.api.v1+json` | When URL stability matters |
| **Query param** (discouraged) | `/api/invoices?version=1` | Only for legacy compat |

BUILD mode rules:
- Always include version in route prefix (detect from existing routes)
- Document version in Swagger JSDoc
- When generating Swagger, include `info.version` field
- Add `deprecated: true` annotation for deprecated endpoints/fields

---

## Standard 3: Request Correlation — Trace IDs

Every API response should include correlation headers for debugging and distributed tracing. Without these, debugging production issues across microservices becomes extremely painful.

```
Response Headers:
  X-Request-Id: uuid-generated-per-request
  X-Trace-Id: uuid-or-from-incoming-header
```

BUILD mode: If the project has request logging middleware, ensure it generates/forwards a request ID. Add `X-Request-Id` to response headers.

ANALYZE mode: Check if responses include correlation headers. Flag as INFO if missing.

---

## Standard 4: Idempotency Keys

POST and PUT endpoints that create or modify resources should support idempotency. This prevents duplicate resource creation from network retries — a common source of bugs in mobile and distributed apps.

```
Request Header:
  Idempotency-Key: client-generated-uuid
```

In BUILD mode:
- Add `Idempotency-Key` as optional header in Swagger JSDoc
- If the project has idempotency middleware, wire it up
- If not, add a comment recommending it for production

---

## Standard 5: Rate Limiting Headers

All APIs should communicate rate limit status via standard headers. This lets well-behaved clients back off before hitting 429s, reducing both server load and user frustration.

```
Response Headers:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1609459200
  Retry-After: 60  (only on 429 responses)
```

BUILD mode: Document 429 response in Swagger JSDoc. If the project has rate limiting middleware, reference it.

ANALYZE mode: Check if 429 responses are documented. Flag as INFO if missing.

---

## Standard 6: Deprecation Strategy

Fields, parameters, and endpoints should be deprecated before removal. Removing something without warning breaks existing clients — even internal ones.

```yaml
# In OpenAPI spec
paths:
  /old-endpoint:
    get:
      deprecated: true
      description: "Use /new-endpoint instead. Removal date: 2026-06-01"
```

BUILD mode rules:
- Never generate deprecated patterns
- If replacing an existing endpoint, mark the old one as `deprecated: true` in Swagger
- Include deprecation timeline in description

---

## Standard 7: API Linting and CI Validation

Recommend Spectral (or equivalent) for automated API contract linting in CI/CD. Catching contract issues before merge prevents breaking changes from reaching production.

```yaml
# .spectral.yml example
extends: "spectral:oas"
rules:
  operation-operationId: error
  operation-description: warn
  oas3-valid-schema-example: error
```

In the compliance checklist (Step 0.6), add: "Is there an API linting step in CI?"

---

## Standard 8: ETags and Conditional Requests

GET endpoints returning single resources should support conditional requests. This reduces bandwidth and server load for frequently polled resources.

```
Response Headers:
  ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

Subsequent Request Headers:
  If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
  → Returns 304 Not Modified if unchanged
```

BUILD mode: Add ETag support as a comment/recommendation for GET /:id endpoints. Don't generate the middleware (that's infrastructure), but document it in Swagger.

---

## Standard 9: Pagination — Support Both Patterns

BUILD mode should offer both pagination strategies:

**Offset-based** (default, for small-medium datasets):
```json
{ "items": [], "total": 100, "page": 1, "limit": 10, "totalPages": 10 }
```

**Cursor-based** (for large/real-time datasets):
```json
{ "items": [], "nextCursor": "eyJpZCI6MTAwfQ==", "hasMore": true }
```

Ask the user which pattern to use. Default to offset-based if not specified.

---

## Standard 10: OWASP API Security Compliance

In both BUILD and ANALYZE modes, check against OWASP API Security Top 10 (2023):

| OWASP Risk | What to Check |
|------------|--------------|
| **API1: Broken Object Level Auth** | Does GET /:id check ownership? Don't just check auth — check if the user owns the resource |
| **API2: Broken Authentication** | Is auth middleware on every protected route? |
| **API3: Broken Object Property Level Auth** | Are sensitive fields (password, token) excluded from responses? |
| **API4: Unrestricted Resource Consumption** | Is there rate limiting? Is `limit` param bounded (max 100)? |
| **API5: Broken Function Level Auth** | Are admin-only endpoints protected with permission checks? |
| **API6: Unrestricted Access to Sensitive Flows** | Are critical operations (delete, status change) protected? |
| **API7: Server-Side Request Forgery** | Are URL inputs validated? |
| **API8: Security Misconfiguration** | Is CORS configured? Are error details hidden in production? |
| **API9: Improper Inventory Management** | Is every endpoint documented in Swagger? |
| **API10: Unsafe API Consumption** | Are third-party API responses validated? |

BUILD mode: Ensure generated code handles API1 (ownership check in service layer), API3 (exclude sensitive fields in select/projection), API4 (bounded limit param).
