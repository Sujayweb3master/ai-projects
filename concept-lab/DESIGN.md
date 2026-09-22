# DESIGN.md — concept-lab UI/UX Plan

## 1. What this app is, design-wise

concept-lab is a **developer tool, not a consumer product**. The single user is a
frontend developer using it to read and experiment with code. The UI's job is to:

1. Make every concept **easy to find** (nav = index of everything the app can teach).
2. Make every concept page **self-explanatory** without opening the source first.
3. Stay **visually calm and consistent** so new concepts slot in without redesign.
4. Look **intentional**, not like unstyled HTML — but never compete with the code
   for attention.

Think "internal docs / Storybook / API playground" aesthetic — not "marketing
site" and not "bare `<form>` with no CSS."

---

## 2. Layout shell

```
┌─────────────────────────────────────────────────────────┐
│ Topbar: "concept-lab"            [ future: search/filter]│
├───────────────┬─────────────────────────────────────────┤
│               │                                          │
│  Sidebar      │   Main content area                      │
│  (nav, grouped│   - Concept title                        │
│   by category)│   - 1–2 line description of what it       │
│               │     demonstrates                         │
│               │   - "Key APIs used" chip/tag list         │
│               │   - The actual interactive form/demo      │
│               │   - (optional) notes/gotchas callout      │
│               │                                          │
└───────────────┴─────────────────────────────────────────┘
```

- **Topbar**: app name/logo-text only for v1. Leaves room for a future
  search-or-filter box once the concept count grows.
- **Sidebar**: persistent, always visible on desktop; collapsible into a
  hamburger/off-canvas panel on narrow viewports. Grouped by category
  (e.g. "React Hook Form", "React Router", "Zod"), each category collapsible.
  Active route is visually highlighted.
- **Main content area**: single column, generous max-width (~720–840px) so
  forms stay readable — this is a reading/tinkering surface, not a dashboard.

This shell lives in one root layout component (`AppShell`) rendered once by
the Data Router's root route; concept pages render inside its `<Outlet />`.

---

## 3. Concept page anatomy (every concept page follows this exact template)

1. **Title** — matches the sidebar label exactly.
2. **Description** — 1–2 plain-English sentences: what this page demonstrates
   and why it's worth knowing.
3. **"Key APIs used"** — small row of tag/chip elements, e.g. `register`,
   `formState.errors`, `defaultValues`. Lets you scan a page in 2 seconds and
   know what you're about to look at.
4. **The demo form itself** — the real content. Fully functional, includes
   visible validation states (error text, disabled/loading submit state,
   success state after submit).
5. **Optional "Notes" callout** — a quiet, visually distinct box for gotchas
   or "compared to X, this does Y" context. Not used on every page.

This consistency is a *design requirement*, not a suggestion — it's what
makes the app scale without becoming a pile of one-off pages.

---

## 4. Visual style

Kept deliberately simple and neutral so it never distracts from code:

- **Type**: system font stack (`-apple-system, Segoe UI, Roboto, sans-serif`)
  for UI chrome; a monospace stack (`ui-monospace, "SF Mono", Consolas`) only
  for code-like values (field names, API tags).
- **Color**: a small neutral palette (background / surface / border / text /
  text-muted) plus **one accent color** for interactive elements (links,
  active nav item, primary buttons, focus rings) and **semantic colors** for
  states: success (green), error (red), warning (amber). No decorative color.
- **Spacing**: 8px base scale (8/16/24/32/48) via CSS custom properties —
  this is also the first real teaching moment for CSS Modules + variables.
- **Density**: comfortable, not cramped — generous line-height and field
  spacing, since forms are the main content type.
- **Dark mode**: nice-to-have, not v1-blocking. If included, driven by
  `prefers-color-scheme` and CSS variables re-declared under a media query —
  no theme-switcher JS needed for v1.

---

## 5. Component states every form must visibly demonstrate

- **Default/empty** state
- **Focus** state (visible focus ring — accessibility, not optional)
- **Invalid field** state (red border + inline error message under the field)
- **Submitting** state (disabled submit button, simple loading indicator)
- **Submit success** state (confirmation message, form either resets or
  shows submitted values — decided per-concept, whichever better demonstrates
  the pattern)

These states are part of the "properly planned UI" requirement — they're
cheap to build and are themselves useful things to see implemented.

---

## 6. Responsiveness

- Desktop-first (this is a developer tool used at a desk), but must not break
  on a laptop or tablet width. Sidebar collapses below ~768px.
- No mobile-specific polish required for v1 — functional, not fancy.

---

## 7. CSS approach (progression-aware — see AGENT-ORCHESTRATOR.md §6 for full rules)

Starting point matches current known baseline (one global stylesheet, `:root`
variables) and layers CSS Modules on top page by page:

1. `styles/variables.css` — all design tokens as `:root` custom properties
   (colors, spacing scale, radii, font stacks).
2. `styles/global.css` — resets + base element styles (body, headings, links,
   form elements) using those variables.
3. Per-component `*.module.css` — scoped styles for `AppShell`, `Sidebar`,
   each concept page, and shared form primitives (`FormField`, `Label`,
   `ErrorText`, `Button`).

No CSS-in-JS, no utility framework (Tailwind) in this app — kept intentionally
plain so the CSS itself is a beginner-readable artifact, consistent with the
"one CSS file + variables" starting point.

---

## 8. Shared form primitives (built once, reused by every concept)

To keep every demo form's JSX readable and focused on the RHF/Zod concept
being taught (not repeated markup), build a tiny shared set:

- `<FormField>` — wraps a label + input + error text with consistent spacing
- `<ErrorText>` — consistent error message styling
- `<SubmitButton>` — consistent button with built-in loading/disabled state
- `<ConceptPageLayout>` — the title/description/tags/notes template from §3

These live in `src/components/` and are the *only* shared UI abstraction in
v1 — resist adding more until a second app-wide need actually appears.