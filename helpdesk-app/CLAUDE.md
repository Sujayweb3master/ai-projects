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
# from helpdesk-app/frontend/
npm run dev | npm test | npm run lint | npm run build
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

## Frontend conventions (`frontend/src`)
- React 19 + JSX, ESM. Structure:
  - `api/` holds thin endpoint functions over `http.js`.
  - `features/<area>/` holds pages, hooks and CSS modules.
  - `components/ui/` holds the shared primitives.
  - `domain/` holds rules, labels and the copy sheet.
- **Auth:** never persist the access token (no localStorage or sessionStorage). Go through `api()` in `api/http.js`; it
  handles Bearer tokens, the 401 single-flight refresh and the cross-tab Web Lock.
- **Server state goes in TanStack Query; UI/session state goes in Zustand.** Mutations update or invalidate the
  `ticketKeys` / `['users']` caches.
- **Ticket list filters live in the URL** (`listParams.js`). Changing any filter resets `page`.
- **Design tokens:** use semantic tokens (`--color-*`, `--space-*`, `--text-*`) from `styles/tokens.css`. No raw
  hex or pixel values, and no inline `style` attributes (the nginx CSP forbids inline styles). Dark mode may only redefine semantic tokens.
- **Copy:** user-facing strings go in `domain/copy.js`. Buttons use sentence case (verb + object) and page titles use title case.
  Errors say what failed and what to do next.
- **Interaction rules:**
  - Reversible actions apply immediately (with Undo when useful). Only irreversible or consequential actions
    (closing a ticket, deactivating a user) use `ConfirmDialog`.
  - Feedback goes next to the control first; toasts are secondary.
- Status rules are mirrored in `domain/ticketStatus.js`; the server is the authority. If the backend table changes,
  update both, plus `ticketStatus.test.js`.

## Accessibility requirements (non-negotiable, WCAG 2.2 AA)
Adapted from the `accessibility-audit` skill's rules file. Audit results are in `docs/ACCESSIBILITY.md`.
- **Semantics first:**
  - Actions use `<button>`, navigation uses `<a href>`.
  - Landmarks: header, nav, main.
  - One `<h1>` per page (use `PageHeader`, which also sets the page title and moves focus on navigation).
  - Tabular data uses `<table>` + `<th scope>`.
  - Form controls use the `Field.jsx` components (a visible `<label>`, `aria-invalid`, `aria-describedby` for hints and errors).
- **Accessible names:**
  - Icon-only buttons get an `aria-label`, and decorative glyphs get `aria-hidden`.
  - An `aria-label` must include the visible text (for example "Deactivate Bob Smith" for a "Deactivate" button).
- **State:** disclosures use `aria-expanded` + `aria-controls`; the current nav item gets `aria-current`; busy regions get `aria-busy`.
- **Dialogs:** only use `ConfirmDialog` (a native `<dialog>` + `showModal()`: focus trap, Esc, focus returned to the trigger).
- **Status messages:** use polite `role="status"` for success and `role="alert"` for errors. The form error summary is focused after a failed submit.
- **Colour and targets:**
  - Text contrast at least 4.5:1, and control boundaries and the focus ring at least 3:1, in both themes.
  - Never use colour alone; badges always carry text.
  - Targets at least 24×24 px.
  - Respect `prefers-reduced-motion`.
- **Tests:**
  - Query by role and accessible name, not test ids. If `getByRole` is hard to write, fix the markup.
  - Add new screens to `src/test/a11y.test.jsx` (axe).
- `npm run lint` includes `jsx-a11y`. Don't disable its rules without a written reason next to the disable comment.

## Testing conventions
- **Backend:** unit tests go in `test/unit`, and HTTP tests against real Postgres go in `test/integration`, using `test/setup/context.js`.
- **Frontend:** tests sit next to the code (`*.test.jsx`). They render the real route tree with `renderApp()` from
  `src/test/render.jsx` against the MSW mock backend (`src/test/msw/`). Assert copy via `domain/copy.js`, and avoid
  tautological tests (don't derive expected values from the code under test).
- New routes must be added to the RBAC matrix in `test/integration/rbac.test.js`.
- Prefer creating fixtures directly in the DB (`createUser`, `createTicket`) and logging in through the API.

## Skills
Repo skills live in `/.claude/skills`. Useful ones: `api-contract-forge`, `architecture`, `testing-strategy`,
`code-review` (backend); `modern-web-guidance`, `interaction-design`, `ux-writing`, `accessibility-audit` (frontend);
`deploy-checklist` (Azure).
