# Response Contract — Single Source of Truth

Every framework template MUST produce responses matching these exact shapes. No exceptions. This ensures any API consumer (frontend, mobile, other microservices) can use one response handler regardless of which backend framework generated the API.

Read this file before generating any controller/handler/router code.

---

## Unified Envelope

Every response (except 204 DELETE) uses the same top-level structure:

```json
{
  "status": true,
  "message": "Human-readable message",
  "data": { ... },
  "error": null
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `status` | `boolean` | Yes | `true` for success, `false` for error |
| `message` | `string` | Yes | Human-readable message (use i18n key if detected) |
| `data` | `object \| null` | Yes | The resource/payload on success, `null` on error |
| `error` | `object \| null` | Yes | Error details on failure, `null` on success |

This unified shape means **one response model** on the client side — no separate success/error parsers needed.

---

## 1. Success — Single Resource

Used by: GET /:id, POST, PUT/PATCH

```json
{
  "status": true,
  "message": "Resource retrieved",
  "data": {
    "id": "uuid-here",
    "title": "Example",
    "amount": 150.00,
    "status": "draft",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  },
  "error": null
}
```

**HTTP status codes:**
- `200` — GET /:id, PUT/PATCH (existing resource returned)
- `201` — POST (new resource created)

---

## 2. Success — Paginated List

Used by: GET / (list endpoints)

```json
{
  "status": true,
  "message": "Data retrieved",
  "data": {
    "items": [
      { "id": "uuid-1", "title": "Example 1" },
      { "id": "uuid-2", "title": "Example 2" }
    ],
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  },
  "error": null
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `data.items` | `array` | Yes | Array of resources. Empty array `[]` if no results — never `null` |
| `data.total` | `number` | Yes | Total count of all matching records (not just this page) |
| `data.page` | `number` | Yes | Current page number (1-based) |
| `data.limit` | `number` | Yes | Items per page |
| `data.totalPages` | `number` | Yes | Calculated: `ceil(total / limit)` |

**Critical rules:**
- `items` is ALWAYS an array — empty `[]`, never `null`, never omitted
- `total` is the count across ALL pages, not just current page
- `page` is 1-based (first page = 1, not 0)
- `totalPages` is calculated by the backend, not the consumer

---

## 3. Success — No Content

Used by: DELETE

```
HTTP 204 No Content
(empty body)
```

No JSON body. Just the status code. Every framework supports this natively.

---

## 4. Error — Validation Error

Used by: POST, PUT/PATCH when input fails validation

```json
{
  "status": false,
  "message": "Validation Error",
  "data": null,
  "error": {
    "type": "validation-error",
    "detail": "One or more fields failed validation",
    "traceId": "req-abc-123",
    "errors": [
      { "field": "email", "message": "Must be a valid email address", "code": "INVALID_FORMAT" },
      { "field": "amount", "message": "Must be greater than 0", "code": "MIN_VALUE" }
    ]
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `error.type` | `string` | Yes | Error category identifier |
| `error.detail` | `string` | Recommended | Specific error description |
| `error.traceId` | `string` | Recommended | Request correlation ID for debugging |
| `error.errors` | `array` | For validation | Field-level error details |
| `error.errors[].field` | `string` | Yes | Field name that failed |
| `error.errors[].message` | `string` | Yes | Human-readable error message |
| `error.errors[].code` | `string` | Yes | Machine-readable error code |

---

## 5. Error — Not Found

```json
{
  "status": false,
  "message": "Resource Not Found",
  "data": null,
  "error": {
    "type": "not-found",
    "detail": "Invoice with id 'abc-123' was not found",
    "traceId": "req-abc-123"
  }
}
```

---

## 6. Error — Unauthorized / Forbidden

```json
{
  "status": false,
  "message": "Unauthorized",
  "data": null,
  "error": {
    "type": "unauthorized",
    "detail": "Invalid or expired authentication token",
    "traceId": "req-abc-123"
  }
}
```

```json
{
  "status": false,
  "message": "Forbidden",
  "data": null,
  "error": {
    "type": "forbidden",
    "detail": "You do not have permission to perform this action",
    "traceId": "req-abc-123"
  }
}
```

---

## 7. Error — Server Error

```json
{
  "status": false,
  "message": "Internal Server Error",
  "data": null,
  "error": {
    "type": "internal-error",
    "detail": "An unexpected error occurred",
    "traceId": "req-abc-123"
  }
}
```

**Never expose stack traces or internal error messages in production.** The `detail` field should be generic. Use `traceId` to look up the full error in server logs.

---

## Nested Resources

### Level 1 — Simple Include

```
GET /api/v1/users/user-001?include=profile
```

```json
{
  "status": true,
  "message": "User retrieved",
  "data": {
    "id": "user-001",
    "name": "Rumit",
    "email": "rumit@example.com",
    "profileId": "prof-001",
    "profile": {
      "id": "prof-001",
      "bio": "Full stack developer",
      "experience": 5
    },
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "error": null
}
```

Without `?include`:
```json
{
  "status": true,
  "message": "User retrieved",
  "data": {
    "id": "user-001",
    "name": "Rumit",
    "email": "rumit@example.com",
    "profileId": "prof-001",
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "error": null
}
```

### Level 2 — Nested Include (Dot Notation)

Use dot notation to include nested relations: `?include=profile.skills`

```
GET /api/v1/users/user-001?include=profile.skills
```

```json
{
  "status": true,
  "message": "User retrieved",
  "data": {
    "id": "user-001",
    "name": "Rumit",
    "email": "rumit@example.com",
    "profileId": "prof-001",
    "profile": {
      "id": "prof-001",
      "bio": "Full stack developer",
      "experience": 5,
      "skills": [
        { "id": "skill-001", "name": "Node.js", "level": "expert" },
        { "id": "skill-002", "name": "Python", "level": "intermediate" }
      ]
    },
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "error": null
}
```

**Important:** `?include=profile.skills` automatically includes `profile` too — you don't need to say `?include=profile,profile.skills`.

### Multiple Includes

Combine with commas: `?include=profile.skills,company`

```
GET /api/v1/users/user-001?include=profile.skills,company
```

```json
{
  "status": true,
  "message": "User retrieved",
  "data": {
    "id": "user-001",
    "name": "Rumit",
    "profileId": "prof-001",
    "companyId": "comp-001",
    "profile": {
      "id": "prof-001",
      "bio": "Full stack developer",
      "skills": [
        { "id": "skill-001", "name": "Node.js", "level": "expert" }
      ]
    },
    "company": {
      "id": "comp-001",
      "name": "Acme Corp"
    },
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "error": null
}
```

### Null and Empty Rules for Nested Data

Every nesting level follows the same rules:

| Scenario | Response | Never Do |
|----------|----------|----------|
| User has no profile (has-one, unassigned) | `"profile": null` | Don't omit the field |
| Profile has no skills (has-many, empty) | `"skills": []` | Don't use `"skills": null` |
| User has no company (belongs-to, unassigned) | `"company": null, "companyId": null` | Don't omit either field |
| Include requested but parent is null | `"profile": null` (skip nested loading) | Don't error or crash |

**Example — user with no profile, skills requested:**
```
GET /api/v1/users/user-002?include=profile.skills
```
```json
{
  "status": true,
  "message": "User retrieved",
  "data": {
    "id": "user-002",
    "name": "New User",
    "profileId": null,
    "profile": null,
    "createdAt": "2025-03-01T08:00:00Z"
  },
  "error": null
}
```
Profile is `null`, so skills are not loaded — the response stops at the null parent. No error.

### Nested Include Rules

1. **Without `?include`** — return foreign key IDs only: `"profileId": "prof-001"`
2. **With `?include=profile`** — return the full nested object at level 1. Nested relations inside profile (like skills) are NOT included unless explicitly requested
3. **With `?include=profile.skills`** — load profile AND skills inside it. The parent is always included when a child is requested
4. **Relations are nullable, not optional** — `"profile": null` when unassigned, never omit the field
5. **Arrays are empty, never null** — `"skills": []` when empty, never `"skills": null`
6. **Max 3 levels of nesting** — `user.profile.skills` is fine (3 levels). `user.profile.skills.endorsements` should be a separate endpoint
7. **Only whitelisted includes allowed** — reject unknown include values with a 400 error
8. **Dot notation for nested** — `profile.skills` means "include profile and inside it include skills"
9. **Include on lists** — same rules apply for list endpoints: `GET /users?include=profile.skills&page=1&limit=10`

---

## Field Naming Rules

| Rule | Correct | Wrong |
|------|---------|-------|
| Use camelCase for JSON fields | `createdAt` | `created_at` |
| Use consistent ID field name | `id` | `_id`, `uuid`, `ID` |
| Use ISO 8601 for dates | `2025-01-15T10:30:00Z` | `2025-01-15`, `1705312200` |
| Booleans are booleans | `true` | `"true"`, `1` |
| Numbers are numbers | `150.00` | `"150.00"` |
| Null means null | `null` | `""`, `{}`, `"null"` |

**Exception:** Backend languages use their own conventions internally (snake_case in Python/Ruby, camelCase in Java/TypeScript). The JSON output MUST be camelCase regardless of the backend language. Use serializer aliases, JSON tags, or response transformers to achieve this.

---

## Framework Implementation Guide

Each framework needs response helpers that produce the exact shapes above. Here's how:

### Frameworks with natural JSON control (Express, FastAPI, Go, Spring Boot)
Create response helper functions/classes that wrap data in the standard envelope.

### Frameworks with opinionated response formats (Django REST, Laravel, Rails)
Override the default serialization to match the standard:
- **Django**: Custom pagination class + custom renderer that wraps responses in the envelope
- **Laravel**: Override `JsonResource` wrapper + custom pagination in the collection
- **Rails**: Custom render helper that wraps serialized output

The key principle: the framework's internal conventions don't matter — the JSON output to the client MUST match this contract. Use the framework's extension points (custom renderers, middleware, response transformers) to normalize the output.

---

## Quick Validation Checklist

Before marking any generated endpoint as complete, verify:

- [ ] Single item response has `status`, `message`, `data`, `error` wrapper
- [ ] List response has `status`, `message`, `data.items`, `data.total`, `data.page`, `data.limit`, `data.totalPages`, `error`
- [ ] Delete returns `204 No Content` with empty body
- [ ] Error responses have `status: false`, `message`, `data: null`, `error` object with `type`, `detail`
- [ ] Validation errors include `error.errors[]` with `field`, `message`, `code`
- [ ] All JSON fields use camelCase
- [ ] Dates are ISO 8601
- [ ] Null relations are `null`, not missing
- [ ] Empty arrays are `[]`, not `null`
- [ ] No raw framework-default responses leak through
