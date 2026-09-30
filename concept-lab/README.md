# concept-lab

A personal frontend learning playground. Each concept is a small, isolated React demo that is easy to run, inspect, and extend.

## Run it

```bash
pnpm install
pnpm dev
```

Other checks:

```bash
pnpm lint
pnpm format:check
pnpm build
```

## Structure at a glance

- `src/concepts/` contains one fully isolated folder per learning concept.
- `src/concepts-registry.js` is the source of truth for every concept’s route and sidebar entry.
- `src/router.jsx` builds the React Router Data Router routes from that registry.
- `src/components/` contains only the shared layout and form primitives.
- `src/styles/` contains global CSS and reusable design tokens.
- `src/api/client.js` is a small client-side fetch wrapper for a future external-API concept.

## Add a new concept

1. Re-read `AGENT-ORCHESTRATOR.md` and `DESIGN.md` first — don't assume prior context carried over.
2. Confirm which category the new concept belongs to (or whether a new category is needed).
3. Create `src/concepts/<new-concept-id>/` with the page component (+ CSS module), following the exact anatomy/state requirements already established.
4. Add one entry to `concepts-registry.js`.
5. Re-use existing shared primitives from `src/components/form-primitives/` wherever they fit; only add a new shared primitive if the need is genuinely app-wide, not concept-specific.
6. Re-check against §7 (complexity ceiling) and §10 (definition of done) before considering it finished.
7. Do not refactor unrelated existing concepts as a side effect unless explicitly asked.
