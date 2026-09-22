# AGENT-ORCHESTRATOR.md — concept-lab

**Read this file in full before writing or changing any code.** This is the
standing charter for the project. It applies to the initial build and to
every future session where a concept is added, changed, or refactored. If
`DESIGN.md` and this file ever seem to disagree, this file wins on
architecture/code decisions and `DESIGN.md` wins on visual/UX decisions.

---

## 1. What concept-lab is

concept-lab is a **personal, ever-growing frontend learning playground**,
owned and read by one developer (Sujay). It is not a product for end users.
Its entire purpose is to hold small, isolated, well-built demonstrations of
frontend concepts — packages, patterns, and language features — so they can
be read, run, and experimented with later, in isolation, without wading
through an unrelated codebase.

The first batch of concepts covers **React Router (Data mode)** and
**React Hook Form + Zod**. More concepts (other packages, JS/CSS patterns,
design patterns) will be added over time, in later sessions, by future agent
invocations. Everything you build now must make that future addition process
trivial.

### Primary audience
Sujay, a frontend developer who is deliberately building depth in the React
ecosystem. He will read the generated code closely, not just click around the
UI. Code clarity and correctness matter more than feature count.

### What this project is explicitly NOT
- Not a production app, not a client deliverable, not a portfolio piece.
- Not a place to prove advanced/clever engineering. Restraint is a feature.
- Not backend software. This is a **pure frontend, client-side app**. There
  is no server, no database, no API you own. Any "API layer" work in this
  project means the client-side pattern for calling *external/future* APIs
  (fetch wrapper, base config, error handling) — never server code.

---

## 2. Governing principles (in priority order)

1. **Code is the deliverable. UI is in service of the code, not the other
   way around.** But "in service of" still means the UI must be genuinely
   well-planned per `DESIGN.md` — not neglected, just not the point.
2. **Every concept is isolated.** One concept = one self-contained unit
   (its own folder, its own files). Reading concept A should never require
   understanding concept B.
3. **Every concept is easy to find and easy to understand at a glance.**
   Navigation is a first-class part of the architecture, not an afterthought
   bolted on at the end (see §5, "Concept Registry").
4. **Complexity ceiling: beginner → intermediate, always, until told
   otherwise.** No pattern, abstraction, or piece of tooling should require
   more than intermediate React/JS knowledge to read. See §7 for a concrete
   do/don't list.
5. **Industry-standard structure and conventions**, scaled down to this
   project's size — not enterprise-grade over-engineering, but not
   tutorial-grade sloppiness either. A hiring manager skimming this repo
   should recognize real engineering habits.
6. **Extensibility over completeness.** It is far better to ship 5 clean,
   easy-to-extend concepts today than 15 concepts bolted on inconsistently.
   Every decision should be evaluated against: "will this make concept #20
   easy or hard to add?"

---

## 3. Tech stack (locked for v1)

| Concern | Choice | Notes |
|---|---|---|
| Build tool | Vite | JavaScript template, not TypeScript |
| Package manager | pnpm | Do not generate a `package-lock.json` or use npm/yarn commands |
| Language | JavaScript (JSX) | No TypeScript, no `.tsx`/`.ts` files, no JSDoc type-checking setup |
| Routing | `react-router` — **Data Router mode** | `createBrowserRouter` / `RouterProvider`. No `<BrowserRouter>` + `<Routes>`/`<Route>` declarative JSX anywhere |
| Forms | `react-hook-form` | Latest stable |
| Schema validation | `zod` + `@hookform/resolvers` | Used specifically in the "Zod integration" concept; other form concepts intentionally do NOT use Zod, so RHF's native validation is visible on its own first |
| Styling | Plain CSS + CSS Modules | No Tailwind, no CSS-in-JS, no component libraries (no MUI/Chakra/etc.) |
| Linting/formatting | ESLint + Prettier | Standard React + hooks rule sets. Keep config minimal and default-leaning, not exotic |
| State management | None beyond React state / RHF's internal state | Do not introduce Redux/Zustand/Jotai/etc. in this project — out of scope and against the complexity ceiling |
| Testing | Not required for v1 | May be proposed later as its own concept category, not part of initial build |

Do not silently upgrade/downgrade this table. If a listed package has a
breaking-change concern (e.g. a major `react-router` version behaving
differently than expected), surface it and ask rather than improvising.

---

## 4. Folder structure (authoritative)

```
concept-lab/
├── public/
├── src/
│   ├── main.jsx                 # entry point, mounts <RouterProvider>
│   ├── router.jsx                # createBrowserRouter config — built FROM the concept registry (see §5)
│   ├── concepts/                 # ⭐ one folder per concept — fully isolated
│   │   ├── rhf-basics/
│   │   │   ├── RhfBasicsPage.jsx
│   │   │   └── RhfBasicsPage.module.css
│   │   ├── rhf-validation-types/
│   │   │   ├── RhfValidationTypesPage.jsx
│   │   │   └── RhfValidationTypesPage.module.css
│   │   ├── rhf-custom-validation/
│   │   │   └── ...
│   │   ├── rhf-advanced-features/
│   │   │   └── ...
│   │   └── rhf-zod-integration/
│   │       └── ...
│   ├── components/               # SHARED, app-wide UI only (kept small — see DESIGN.md §8)
│   │   ├── layout/
│   │   │   ├── AppShell.jsx
│   │   │   ├── AppShell.module.css
│   │   │   ├── Sidebar.jsx
│   │   │   └── Sidebar.module.css
│   │   └── form-primitives/
│   │       ├── FormField.jsx
│   │       ├── ErrorText.jsx
│   │       ├── SubmitButton.jsx
│   │       ├── ConceptPageLayout.jsx
│   │       └── *.module.css
│   ├── concepts-registry.js      # ⭐ single source of truth — see §5
│   ├── api/                      # client-side layer for FUTURE external API calls (no backend)
│   │   └── client.js             # thin fetch wrapper, base config, error handling — scaffolded, may be unused until an API-driven concept is added
│   ├── styles/
│   │   ├── variables.css         # design tokens as :root custom properties
│   │   └── global.css            # resets + base element styles
│   └── lib/                      # small pure utility functions only, added as actually needed
├── .eslintrc.* (or eslint.config.js)
├── .prettierrc
├── vite.config.js                # includes path alias setup (e.g. `@/`)
├── package.json
└── README.md                     # human-facing quickstart + "how to add a concept" summary
```

**Rules:**
- Nothing inside `src/concepts/<concept-name>/` may be imported by another
  concept folder. If two concepts seem to need the same non-trivial logic,
  that logic gets promoted to `src/components/` or `src/lib/`, not copy-pasted
  silently and not cross-imported.
- No barrel files (no `index.js` that re-exports everything from a folder)
  inside `concepts/`. Imports should be explicit and traceable
  (`import RhfBasicsPage from '@/concepts/rhf-basics/RhfBasicsPage'`), so a
  beginner reading `router.jsx` can see exactly where each page's code lives
  without following re-export indirection.
- Path aliases (`@/` → `src/`) are configured in `vite.config.js` so imports
  don't accumulate `../../../`.

---

## 5. The Concept Registry (core architectural decision — do not deviate)

A single file, `src/concepts-registry.js`, is the **one place** that
declares every concept in the app. Both the router and the sidebar
navigation are generated FROM this file — they must never be maintained as
two separate hand-written lists that can drift out of sync.

Shape (illustrative — adapt naming, keep the structure):

```js
// src/concepts-registry.js
export const conceptsRegistry = [
  {
    category: 'React Hook Form',
    concepts: [
      {
        id: 'rhf-basics',
        title: 'RHF Basics',
        path: '/rhf/basics',
        description:
          'register(), defaultValues, and reading errors from formState.',
        tags: ['register', 'defaultValues', 'formState.errors'],
        component: () => import('@/concepts/rhf-basics/RhfBasicsPage'),
      },
      // ...more concepts in this category
    ],
  },
  {
    category: 'React Router',
    concepts: [
      // future routing concepts land here
    ],
  },
];
```

`router.jsx` iterates this registry to build the `createBrowserRouter` route
tree (children of the root `AppShell` route). `Sidebar.jsx` iterates the same
registry to render the grouped, categorized nav. This is what makes
"isolated and easily accessible" true by construction rather than by
discipline — adding a concept to the registry is enough for it to appear in
both nav and routing.

**Adding a new concept later = :**
1. Create `src/concepts/<new-concept>/` with its page component + CSS module.
2. Add one entry to `concepts-registry.js`.
3. Done — no router file edits, no nav file edits.

This step-list belongs in `README.md` verbatim for quick reference.

---

## 6. Styling conventions

Follow `DESIGN.md` for the actual visual plan. Engineering rules here:

- All design tokens (colors, spacing scale, radii, font stacks) live as
  `:root` custom properties in `src/styles/variables.css`. No hard-coded hex
  values or magic pixel numbers inside component CSS Modules — reference the
  variables.
- `src/styles/global.css` handles resets and bare element styling (body,
  headings, base form element appearance) — imported once in `main.jsx`.
- Every component that needs scoped styling gets a co-located
  `ComponentName.module.css`. Class names in JSX via
  `styles.className`, imported as `import styles from './X.module.css'`.
- Start simple: this project's CSS should stay readable by someone who only
  knows single global stylesheets + `:root` variables today. Introduce CSS
  Modules composition (`composes:`) only once it's clearly useful, not
  preemptively.

---

## 7. Complexity ceiling — concrete do/don't list

**Do:**
- Plain function components, hooks used directly and legibly.
- Comments where a concept's *point* isn't obvious from reading the code
  alone (e.g. why `useController` is needed instead of `register` in a given
  case).
- Small, single-purpose files. A concept page can be one file if it's not
  unwieldy; split into a page + a couple of small subcomponents only if that
  genuinely improves readability.
- Realistic but simple form fields (name/email/age/select/checkbox-style
  examples) — no need for elaborate domain data.

**Don't:**
- No custom hooks that wrap RHF in another abstraction layer "for reuse" —
  the point is to see RHF's own API directly, not a home-grown wrapper
  around it.
- No premature generalization ("what if we need 10 more form types" logic)
  beyond the Concept Registry pattern itself.
- No state management libraries, no data-fetching libraries (React
  Query/SWR) — out of scope for this batch of concepts.
- No TypeScript, no PropTypes-heavy ceremony.
- No deeply nested folder hierarchies beyond what's in §4.
- No "clever" one-liners (chained ternaries, dense reduce/regex one-liners)
  where a few plain, named lines would read more clearly. If a genuinely
  idiomatic RHF/Zod pattern IS terse (e.g. a Zod schema), that's fine — the
  ceiling is about avoiding unnecessary cleverness, not avoiding idiomatic
  library usage.

---

## 8. The "API layer" — scope clarification (important)

There is **no backend in this project, and there will never be one.**
`src/api/client.js` exists only to demonstrate the **client-side pattern**
for calling external APIs in a real frontend app — e.g.:

- a small `fetch` wrapper with base URL config and consistent error handling
- ready to be used by a *future* concept such as "data fetching with a
  React Router loader" or "submitting a form to a real API endpoint"

Until such a concept exists, this file may be minimal/unused — do not build
out elaborate API-handling logic speculatively. When a future concept needs a
real API to call against, prefer a free public test API (e.g.
JSONPlaceholder) rather than inventing a fake one.

---

## 9. Initial concept set to build now

Each of these is a fully isolated concept per §4/§5, with its page following
the anatomy defined in `DESIGN.md` §3 (title, description, key-APIs tags,
the working form, optional notes).

1. **`rhf-basics`** — RHF Basics
   - `useForm`, `register()`, `defaultValues`, reading `formState.errors`.
   - Minimal validation (e.g. just `required`) — this page is about the
     *mechanics*, not the range of validation options.

2. **`rhf-validation-types`** — Validation Types
   - A form whose fields collectively showcase RHF's built-in validation
     rules: `required`, `minLength`/`maxLength`, `min`/`max`, `pattern`,
     and any other commonly-used native HTML validation-style rules RHF
     supports via `register`'s options object.

3. **`rhf-custom-validation`** — Custom Validation
   - Demonstrates the `validate` option (single function and/or object-of-
     functions form) for logic that built-in rules can't express — e.g.
     cross-field checks (password confirmation), async-style custom checks
     if appropriate, business-rule-style validation.

4. **`rhf-advanced-features`** — Lesser-Known RHF Tools
   - A curated tour of useful-but-less-obvious RHF functionality, e.g.:
     `watch`, `useWatch`, `useFieldArray` (dynamic field arrays),
     `useController` (for non-native/controlled inputs), `setValue`,
     `getValues`, `trigger`, `reset`, and dependent/conditional fields.
   - This page may reasonably be a bit larger since it's a tour, but each
     feature should still get its own clearly labeled section within the
     page.

5. **`rhf-zod-integration`** — Zod + React Hook Form
   - `zodResolver` from `@hookform/resolvers/zod` wired into `useForm`.
   - A Zod schema demonstrating a few common Zod patterns (string
     constraints, `refine` for cross-field validation, sensible error
     messages) mapped to the same kind of form fields used elsewhere, so the
     contrast with the native-RHF-validation concept page is easy to see.

These five live under the "React Hook Form" category in the registry. Leave
a "React Router" category present (even if its first entries are added in a
later session) so the registry's category grouping is visibly in place from
day one.

---

## 10. Definition of done (per concept, and for the initial build overall)

A concept page is done when:
- [ ] It lives fully inside its own `src/concepts/<name>/` folder.
- [ ] It's registered in `concepts-registry.js` with an accurate
      `description` and `tags`.
- [ ] It follows the page anatomy in `DESIGN.md` §3.
- [ ] It visibly demonstrates all the component states in `DESIGN.md` §5
      relevant to that concept (at minimum: default, invalid, submitting,
      success).
- [ ] Labels are properly associated with inputs (accessible form markup —
      real `<label htmlFor>`, not placeholder-only fields).
- [ ] No console errors/warnings on load or on interaction.
- [ ] Code stays within the complexity ceiling in §7.

The initial build overall is done when:
- [ ] `pnpm create vite` scaffold exists at the correct location, JS
      template, and runs cleanly with `pnpm install && pnpm dev`.
- [ ] Data Router is wired up and working (root layout + child routes from
      the registry, with a basic 404/not-found route).
- [ ] All 5 concepts in §9 are built and reachable from the sidebar.
- [ ] ESLint + Prettier are configured and the codebase passes lint cleanly.
- [ ] `README.md` explains: how to run the project, the folder structure at
      a glance, and the exact steps to add a new concept (from §5).

---

## 11. How to add a new concept in a future session (for future agent runs)

1. Re-read this file and `DESIGN.md` first — don't assume prior context
   carried over.
2. Confirm which category the new concept belongs to (or whether a new
   category is needed).
3. Create `src/concepts/<new-concept-id>/` with the page component (+ CSS
   module), following the exact anatomy/state requirements already
   established.
4. Add one entry to `concepts-registry.js`.
5. Re-use existing shared primitives from `src/components/form-primitives/`
   wherever they fit; only add a new shared primitive if the need is
   genuinely app-wide, not concept-specific.
6. Re-check against §7 (complexity ceiling) and §10 (definition of done)
   before considering it finished.
7. Do not refactor unrelated existing concepts as a side effect unless
   explicitly asked.