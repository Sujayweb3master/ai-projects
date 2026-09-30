# CLAUDE.md — helpdesk-app

Guidance for AI agents and humans working in `helpdesk-app/`. The approved design lives in `docs/PLAN.md`.

## Hard rules
- Work only inside `helpdesk-app/` and `.github/workflows/helpdesk-*.yml`. **Never modify `concept-lab/`.**
- Branch `feat/helpdesk-app`. Make small commits with conventional messages (`feat(helpdesk-api): …`, `test(…)`, `docs(…)`).
- This repo is **public**. Never commit `.env`, secrets, keys or Azure credentials. Azure auth uses GitHub OIDC.
- Don't claim something works without running it. If something can't run in the environment, say so.

## Commands
```bash
# from helpdesk-app/
npm install && npm run format:check
# from helpdesk-app/backend/
npm run dev | npm test | npm run test:coverage | npm run lint
npm run db:generate   # after editing src/db/schema.js; review the generated SQL
npm run db:migrate | npm run db:seed
docker compose up --build   # from helpdesk-app/
```
Tests need `DATABASE_URL_TEST` pointing at a database whose name ends in `_test`. The test run drops and recreates its schema.

## Backend conventions (`backend/src`)
- ES modules, JSDoc types, no TypeScript. Prettier: single quotes, width 100.
- Put each feature in `modules/<feature>/`, split into `*.routes.js` (HTTP + `validate()` + `requireRole`),
  `*.service.js` (business rules, object-level checks, transactions) and `*.schemas.js` (strict Zod).
- **Every route** validates params/query/body with `.strict()` Zod schemas. Read parsed input from `req.valid`
  (Express 5 makes `req.query` read-only).
- Throw `AppError` helpers from `lib/errors.js`, never `res.status(...).json(...)` for errors.
  Error shape: `{ error: { code, message, details?, requestId } }`. Lists return `{ data, meta }`.
- Object-level access: use `getAccessibleTicket` and return 404 for tickets the actor can't see.
- Write audit events (`ticket_events`) in the **same transaction** as the change.
- Status rules live only in `domain/ticketStatus.js`.
- Never return `passwordHash`. Serialise users through `toUserDto`.
- Use Drizzle query-builder calls only. No string-concatenated SQL. Escape user LIKE input with `escapeLike`.
- Adding config: add it to `config/env.js` (Zod), `.env.example`, and the README table.

## Testing conventions
- Unit tests go in `test/unit`, and HTTP tests against real Postgres go in `test/integration`, using `test/setup/context.js`.
- New routes must be added to the RBAC matrix in `test/integration/rbac.test.js`.
- Prefer creating fixtures directly in the DB (`createUser`, `createTicket`) and logging in through the API.

## Skills
Repo skills live in `/.claude/skills`. Useful ones: `api-contract-forge`, `architecture`, `testing-strategy`,
`code-review` (backend); `modern-web-guidance`, `interaction-design`, `ux-writing`, `accessibility-audit` (frontend);
`deploy-checklist` (Azure).
