---
name: api-contract-forge
description: "Backend API contract skill. Build new APIs with best contracting standards for any tech stack, infer types from JSON responses, detect inconsistencies, and generate contract artifacts (TypeScript, Zod, Pydantic, OpenAPI, JSON Schema). Triggers on: build api, new endpoint, api contract, generate types, infer schema, normalize API, scaffold api, create api for [resource]. Also trigger when a user pastes a raw JSON object and asks about its types or schema, when they mention REST API design, endpoint scaffolding, contract-first development, type safety for APIs, API response validation, or breaking change detection — even if they don't explicitly say 'contract'."
---

# API Contract Forge

A universal skill for API contracting with two modes:

1. **BUILD** — Scaffold new API endpoints with proper contracting (validation, typed responses, documentation) for any tech stack
2. **ANALYZE** — Take raw JSON API responses, infer types, detect inconsistencies, and generate backend contract artifacts

## Core Workflow

Pick the mode based on what the user needs:

- **BUILD mode** (Phase 0) — User wants to create a NEW API endpoint
- **ANALYZE mode** (Phases 1-6) — User has an EXISTING API response to analyze

---

## BUILD MODE — Create New API Endpoints with Contracting

### Phase 0.1: DETECT — Auto-Detect Project Tech Stack

Scan the project to determine the framework, language, and existing patterns. Check these files:

| File | Detects |
|------|---------|
| `package.json` | Node.js framework (Express, Fastify, NestJS, Hono, Koa) + validation lib (Zod, Joi, class-validator) + ORM (Prisma, TypeORM, Mongoose, Sequelize, Drizzle) |
| `requirements.txt` / `pyproject.toml` / `Pipfile` | Python framework (FastAPI, Django REST, Flask) + ORM (SQLAlchemy, Django ORM, Tortoise) |
| `build.gradle` / `pom.xml` | Java/Kotlin framework (Spring Boot, Ktor) |
| `go.mod` | Go framework (Gin, Echo, Fiber, Chi) |
| `Gemfile` | Ruby framework (Rails, Sinatra) |
| `pubspec.yaml` | Dart backend (shelf, dart_frog) |
| `Cargo.toml` | Rust framework (Actix, Axum, Rocket) |
| `composer.json` | PHP framework (Laravel, Symfony) |

Also scan for existing route files, controllers/handlers, validation schemas, type/model files, Swagger/OpenAPI config, and database config.

**Output a detection summary:**
```
Project Detection
=================
Language:    TypeScript
Framework:   Express 4.x
Validation:  Zod 3.x
ORM:         Prisma 5.x (PostgreSQL)
Docs:        Swagger via swagger-jsdoc
Response:    Custom helpers (sendSuccess, sendError, sendPaginatedResponse)
Structure:   routes/ → controllers/ → services/
Auth:        JWT middleware (authenticate)
Permissions: requirePermission("resource.action.scope")
i18n:        i18next (req.t)
```

If detection fails or is ambiguous, ask the user to confirm.

### Phase 0.2: GATHER — Collect Resource Requirements

Ask the user for:

1. **Resource name** (e.g., "invoice", "meal-plan", "appointment")
2. **Fields** — name, type, required/optional, validation rules. Accept natural language, JSON samples, or existing database models.
3. **Operations** — which CRUD operations to generate:
   - `C` — Create (POST), `R` — Read (GET /:id), `L` — List (GET /), `U` — Update (PUT/PATCH /:id), `D` — Delete (DELETE /:id)
   - Custom operations (e.g., "POST /:id/send")
4. **Relations** (optional) — belongs to company, has many items, etc.
5. **Permissions** (optional) — what permission pattern to use
6. **Special requirements** (optional) — these have full template support in `references/build-patterns.md`:
   - **File upload** — multipart endpoints, file validation, storage service
   - **Soft delete** — `deletedAt` field, auto-filtering, restore endpoint, trash listing
   - **Relationship loading** — `?include=company,items` with ORM-specific eager loading
   - **Advanced filtering** — date ranges, numeric ranges, multi-value enums, null checks

**Handling partial generation:**

| User says | What to generate |
|-----------|-----------------|
| "create an invoice API" | Only `C` (POST) — single endpoint |
| "I need GET and POST for invoices" | Only `R`, `L`, `C` — specified endpoints |
| "build invoice CRUD" or just "invoice" | Full `CRLUD` — all 5 operations |
| "invoice with C, R, U" | Only `C`, `R`, `U` — specified subset |
| "POST /invoices/:id/send" | Only the custom operation |

If the user specifies exact operations, generate only those — nothing more. If they give just a resource name with no operation hint, generate full CRUD. If ambiguous, ask.

### Phase 0.3: GENERATE — Create Contract Layers

Generate files following the detected project conventions. The output should match the existing codebase patterns exactly — same file naming, same folder structure, same code style, same import patterns.

**IMPORTANT: Always read `references/response-contract.md` first.** This defines the unified response envelope that ALL frameworks must produce. Every generated controller/handler must wrap responses in the `{ status, message, data, error }` shape. No framework-specific response formats are allowed — the JSON output must be identical regardless of backend language.

**Then read the appropriate framework reference for code templates:**

| Detected Framework | Reference File |
|-------------------|----------------|
| Express + TypeScript | `references/build-express.md` |
| NestJS | `references/build-nestjs.md` |
| FastAPI | `references/build-fastapi.md` |
| Django REST Framework | `references/build-django.md` |
| Go (Gin/Echo/Chi) | `references/build-go.md` |
| Spring Boot (Kotlin/Java) | `references/build-spring-boot.md` |
| Laravel | `references/build-laravel.md` |
| Ruby on Rails | `references/build-rails.md` |

Generate only the operations the user requested in Phase 0.2. If they asked for only Create, generate only the create schema, route, controller method, and service method.

If the user requested any special requirements (file upload, soft delete, relationship loading, advanced filtering), also read `references/build-patterns.md` for cross-framework templates for those patterns.

### Phase 0.4: REGISTER — Wire Up the New Endpoint

After generating files, show the user what needs to be wired:

1. **Register route** — add import and route registration in the main routes file
2. **Register i18n keys** — add translation keys for success/error messages (if i18n detected)
3. **Add permissions** — add new permission strings to the permission seed/config (if RBAC detected)
4. **Database migration** — create table/collection (Prisma migrate, Alembic, Rails migration, etc.)

Provide the exact code snippets to paste, with file paths.

### Phase 0.5: CHECKLIST — Contract Compliance Verification

After generation, run through this checklist and report pass/fail. Read `references/industry-standards.md` for the detailed standards behind each check.

```
Contract Compliance Checklist
=============================

VALIDATION & TYPES:
  [PASS/FAIL] Validation schema exists for every POST/PUT endpoint
  [PASS/FAIL] Validation middleware applied on every route
  [PASS/FAIL] All types derived from validation schemas (no duplicate definitions)

RESPONSE FORMAT:
  [PASS/FAIL] Response uses standard envelope (ApiResponse / sendSuccess)
  [PASS/FAIL] Paginated list uses standard pagination shape
  [PASS/FAIL] Error responses follow consistent format (RFC 9457 recommended)
  [PASS/FAIL] No raw res.json() — all responses through helpers

DOCUMENTATION:
  [PASS/FAIL] Swagger/OpenAPI JSDoc on every route
  [PASS/FAIL] All response codes documented (200, 201, 400, 401, 403, 404, 500)
  [PASS/FAIL] API version included in route prefix and Swagger info

SECURITY (OWASP):
  [PASS/FAIL] Auth middleware applied on protected routes
  [PASS/FAIL] Permission checks on every route (if RBAC detected)
  [PASS/FAIL] List endpoint limit param bounded (max 100)
  [PASS/FAIL] Sensitive fields excluded from response (password, tokens)
  [PASS/FAIL] 429 Too Many Requests documented in Swagger

PRODUCTION READINESS:
  [PASS/FAIL] Request correlation (X-Request-Id) supported or recommended
  [PASS/FAIL] Idempotency-Key documented for POST endpoints
  [PASS/FAIL] i18n message keys used (if i18n detected)
  [PASS/FAIL] Timestamps (createdAt/updatedAt) included in response
```

---

## ANALYZE MODE — Work with Existing API Responses

### Phase 1: RECEIVE — Accept Raw JSON Input

Ask the user to provide:

1. **One or more raw JSON API responses** (paste directly or provide file path)
2. **Endpoint info** (optional): HTTP method, URL path, description
3. **Target languages** (optional): Which languages to generate for. If not specified, ask.

Accepted input formats: raw JSON in chat, file path to `.json`, URL to a live API endpoint, or multiple responses for comparison.

### Phase 2: ANALYZE — Deep Recursive Inference

Walk the entire JSON tree recursively and build a type map. For every field at every nesting level:

**Type Detection:**

| JSON Value | Inferred Type | Notes |
|---|---|---|
| `"string"` | `string` | Check format: email, date, datetime, uuid, url, iso8601 |
| `123` | `number` | Distinguish integer vs float if all values are whole numbers |
| `true/false` | `boolean` | |
| `null` | `nullable` | Mark parent field as `T \| null` |
| `[]` | `array<T>` | Infer T from items. If empty, mark as `array<unknown>` and flag |
| `{}` | `object` | Recurse. If empty `{}`, flag as ambiguous |
| Mixed array | `union` | Create discriminated union for different shapes |

**Format Detection** — auto-detect and annotate: UUID (`/^[0-9a-f]{8}-…$/i`), ObjectId (`/^[0-9a-f]{24}$/i`), Email (`/@/`), ISO DateTime, URL (`http(s)://`), JWT (`xxxxx.xxxxx.xxxxx`), Enum candidates (few distinct values across samples).

**Nullable vs Optional — this distinction is critical because getting it wrong causes either runtime crashes (treating optional as required) or data loss (treating nullable as absent):**

- Field exists with `null` → `T | null` (nullable)
- Field missing in some responses → `T | undefined` (optional)
- Field `null` in some, missing in others → `T | null | undefined` (nullable + optional)
- Empty string `""` → flag: intentional or should be null?
- Empty object `{}` → flag: intentional or should be null/omitted?
- Empty array `[]` → `array<T>`, not nullable (empty is valid)

**Deeply Nested Objects:** For objects nested 3+ levels deep, create named sub-types (e.g., `MealSlot`, `NutritionDetail`). Never inline deep structures — they become unreadable and impossible to reuse. Track full JSON paths. Detect dynamic keys and use `Record<string, T>` or equivalent.

**Auto-detect pagination patterns:** offset-based (`page`, `limit`, `total`), cursor-based (`cursor`, `next_cursor`, `has_more`), extended offset. Extract as a separate generic type.

**Auto-detect response envelope patterns:** `{ success, message, data }`, `{ statusCode, message, data }`, etc. Extract as a separate generic type so the payload type stays clean.

### Phase 3: REPORT — Inconsistency Detection

Compare and report issues across responses or within repeated structures:

**CRITICAL (will cause runtime crashes):**
- Field exists in one response but missing in another
- Field is `null` in one but an object in another
- Field type differs between responses (string vs number)
- ID field naming inconsistency (`_id` vs `id` vs `uuid`)
- Array item shapes differ across items

**WARNING (may cause silent bugs):**
- Optional field present in some array items, absent in others
- Empty object `{}` where populated object expected
- Numeric string `"1"` where number `1` expected
- Inconsistent casing (camelCase mixed with snake_case)

**INFO (style recommendations):**
- Pagination/envelope differences between endpoints
- Date format inconsistencies
- Boolean representation differences

**Report format:**
```
API Contract Analysis Report
============================
Endpoint: GET /endpoint
Nesting Depth: N levels
Total Fields: N unique fields
Named Types Needed: N

CRITICAL Issues (N):
  [C1] Description + path + decision needed

WARNINGS (N):
  [W1] Description + suggestion
```

**Interactive Resolution:** For each CRITICAL and WARNING, present options and ask the user to decide (e.g., "Make it required / Make it optional / Make it nullable+optional"). Only proceed to Phase 4 after all critical issues are resolved.

### Phase 4: GENERATE — Multi-Language Contract Artifacts

Read `references/analyze-generators.md` for language-specific generation rules and templates. Supports: TypeScript interfaces, Zod schemas, OpenAPI 3.1, Pydantic models, JSON Schema.

Ask which targets the user wants if not specified. Generate one file per language.

### Phase 5: COMPARE — Breaking Change Detection (Optional)

If the user provides two versions of a response (old vs new), detect breaking changes:

**Breaking (will crash clients):** removed required field, type changed, required field added, enum value removed, nullable→non-nullable, array shape changed.

**Non-Breaking (safe to deploy):** new optional field, new enum value, non-nullable→nullable, new endpoint, description changed.

Present a clear report separating breaking vs non-breaking, with impact and recommended action for each.

### Phase 6: VALIDATE — Check Existing Code Against Contract (Optional)

If the user has an existing codebase, scan it to find TypeScript interfaces / Pydantic models / validation schemas and compare against the inferred contract. Report: type mismatches, missing fields, extra fields, nullable/optional discrepancies.

---

## Anti-Patterns to Detect and Flag

Always check for these common API anti-patterns:

1. **Mixed naming conventions** — camelCase and snake_case in same response
2. **Inconsistent ID fields** — `_id`, `id`, `uuid`, `ID` in same API
3. **Boolean as string** — `"true"` instead of `true`
4. **Number as string** — `"1"` instead of `1` (especially `serving`, `page`, `limit`)
5. **Inconsistent null representation** — `null` vs `""` vs `{}` vs missing field
6. **Over-nested responses** — data buried 5+ levels deep without clear reason
7. **Inconsistent pagination** — different list endpoints using different shapes
8. **Inconsistent envelope** — different endpoints wrapping data differently
9. **Sensitive data exposure** — JWT tokens, passwords in responses (OWASP API3)
10. **Missing timestamps** — records without `createdAt`/`updatedAt`
11. **No error traceability** — error responses without request/trace ID
12. **Unbounded list queries** — list endpoints without max limit (OWASP API4)
13. **Missing 429 documentation** — no rate limit responses in Swagger
14. **No deprecation path** — breaking changes without deprecation notice

## Output Rules

1. Always generate a header comment with source endpoint, timestamp, and tool attribution
2. Always extract nested types — never inline objects deeper than 2 levels
3. Always separate envelope/pagination from payload types
4. Add comments on fields where an inconsistency was resolved
5. Confirm target languages with user before generating
6. Never guess on ambiguous types — ask the user to decide
7. Generate one file per language
8. Use the language's conventions — snake_case for Python, camelCase for TypeScript, etc.
9. Include example values as comments where helpful

## Quick Reference

| User Says | Mode | Phases |
|---|---|---|
| "Build a new invoice API" | BUILD | 0.1 → 0.2 → 0.3 → 0.4 → 0.5 |
| "Create CRUD for meal-plans" | BUILD | 0.1 → 0.2 → 0.3 → 0.4 → 0.5 |
| "Add a new endpoint for appointments" | BUILD | 0.1 → 0.2 → 0.3 → 0.4 → 0.5 |
| "Scaffold a users API with Express + Zod" | BUILD | 0.1 → 0.2 → 0.3 → 0.4 → 0.5 |
| "Here's my API response" + JSON | ANALYZE | 1 → 2 → 3 → 4 |
| "Compare these two responses" | ANALYZE | 1 → 2 → 3 → 5 |
| "Check my types against this response" | ANALYZE | 1 → 2 → 6 |
| "Generate TypeScript types" | ANALYZE | 4 (TypeScript only) |
| "What's wrong with this API response?" | ANALYZE | 2 → 3 (report only) |
| "Normalize this API" | ANALYZE | 2 → 3 → 4 (envelope standardization) |

## References

| File | When to Read |
|------|-------------|
| `references/response-contract.md` | **ALWAYS read first** in BUILD mode — defines the standard response envelope all frameworks must produce |
| `references/build-express.md` | BUILD mode + Express detected |
| `references/build-nestjs.md` | BUILD mode + NestJS detected |
| `references/build-fastapi.md` | BUILD mode + FastAPI detected |
| `references/build-django.md` | BUILD mode + Django REST detected |
| `references/build-go.md` | BUILD mode + Go (Gin/Echo/Chi) detected |
| `references/build-spring-boot.md` | BUILD mode + Spring Boot detected |
| `references/build-laravel.md` | BUILD mode + Laravel detected |
| `references/build-rails.md` | BUILD mode + Rails detected |
| `references/build-patterns.md` | BUILD mode + special requirements (file upload, soft delete, relationship loading, advanced filtering) |
| `references/build-tests.md` | Optional — contract test templates for all 8 frameworks (use when team wants to verify response envelope) |
| `references/analyze-generators.md` | ANALYZE mode Phase 4 (generating contract artifacts) |
| `references/industry-standards.md` | BUILD mode Phase 0.5 (compliance checklist) or ANALYZE mode (flagging issues) |
