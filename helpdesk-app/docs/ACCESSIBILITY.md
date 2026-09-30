# Accessibility Audit: Helpdesk Web App

**Standard:** WCAG 2.2 AA · **Date:** 2026-09-30 · **Build:** `feat/helpdesk-app` (Phase 3)
**Method:** the `accessibility-audit` skill's 5-layer process, plus the `accessibility-review` skill for manual criteria.

## Summary

| | Result |
|---|---|
| Automated scan (axe-core 4.x in Chromium, WCAG 2.0/2.1/2.2 A+AA + best practice) | **0 violations** on 12 screens × 2 themes (24 scans) plus the mobile list at 390 px (4 scans) |
| Component-level axe checks (jsdom, in CI) | 5 screens, 0 violations (`src/test/a11y.test.jsx`) |
| Keyboard | Everything reachable and operable; logical order; visible 2 px focus ring |
| Reflow at 320 px (1.4.10) | No page-level horizontal scroll on list, users and form pages |
| Colour contrast (both themes) | All text ≥ 4.5:1; control borders and focus ring ≥ 3:1 (see table) |
| Screen reader | **Not tested with a real screen reader** (none available in the build environment). Names, roles and states were checked through Chromium's accessibility tree instead |

**Issues found and fixed during the audit:** 5 (0 remaining critical/serious).

## Findings (all fixed)

| # | Issue | WCAG | Severity | Fix |
|---|---|---|---|---|
| 1 | Visually-hidden labels inside table cells were absolutely positioned outside the scroll container and widened the Users page by 195 px at 320 px | 1.4.10 Reflow | Serious | `position: relative` on table scroll regions |
| 2 | Error-summary links were 16 px tall and adjacent | 2.5.8 Target Size | Serious (axe) | 24 px link targets; links also move focus into the field |
| 3 | Control borders in light mode were 2.56:1 against white | 1.4.11 Non-text Contrast | Major | `--color-border-strong` slate-400 → slate-500 (4.76:1) |
| 4 | Posting a comment gave no non-visual confirmation | 4.1.3 Status Messages | Moderate | Polite `role="status"` "Comment posted" |
| 5 | Browser-default placeholders are faint, especially in dark mode | 1.4.3 (best practice) | Minor | `::placeholder` uses the muted token (≥ 6.9:1) |

Design-critique fixes that also help accessibility: mobile filters collapse behind a disclosure button
(`aria-expanded` + `aria-controls`), and table rows become stacked cards with explicit table roles. The
accessibility tree still reports `table › row › cell` at 390 px.

## Colour contrast (token pairs)

| Element | Light | Dark | Required |
|---|---|---|---|
| Body text (slate-900 / slate-100) | 17.9:1 | 16.3:1 | 4.5:1 |
| Muted text on surface | 7.58:1 | 6.96:1 | 4.5:1 |
| Primary button text (white on indigo-600) | 6.29:1 | 6.29:1 | 4.5:1 |
| Link | 7.90:1 | 8.96:1 | 4.5:1 |
| Status badge (e.g. Open: sky-800 on sky-100) | 6.59:1 | ≥ 8:1 | 4.5:1 |
| Control border | 4.76:1 | 3.75:1 | 3:1 |
| Focus ring | 6.29:1 | 5.98:1 | 3:1 |

Status and priority never rely on colour: every badge has a text label, HIGH priority adds a ▲ icon, and statuses use a dot + text.

## Keyboard navigation

| Element | Behaviour verified |
|---|---|
| Skip link | First Tab stop; visible on focus; Enter moves focus to `<main>` |
| Route change | Focus moves to the page `<h1>`; `document.title` updates per route |
| Filters | Checkbox chips are native checkboxes (Space toggles); the Search box is debounced and needs no Enter |
| Status / assignee controls | Native `<select>` plus an explicit **Update** button, so arrow keys never trigger a save |
| Confirm dialogs | Native `<dialog>` + `showModal()`: focus moves inside, Tab stays inside, Esc cancels, focus returns to the trigger |
| Error summary | Receives focus after a failed submit; each link moves focus to its field |
| Toasts | Polite live region; pause while hovered or focused; Undo is reachable by keyboard |

## Screen-reader checks (via the accessibility tree, not a real screen reader)

| Element | Exposed as |
|---|---|
| Ticket list | `table "Tickets"` with column headers; stays a table in the mobile card layout |
| Password toggle | `button "Show password"` / `"Hide password"` (label includes the visible text, 2.5.3) |
| Row actions | `button "Deactivate Bob Smith"`, and `combobox "Role for Bob Smith"` |
| Badges | e.g. "Role: Admin" (visually hidden prefix) |
| Form errors | `aria-invalid="true"` plus `aria-describedby` → error text; the summary has `role="alert"` |

## Known gaps / next steps

1. **Manual VoiceOver + NVDA pass.** Not possible here. Recommended before production, especially for toast
   announcements and the focus behaviour on route changes.
2. **200 % text-only zoom.** Reflow was checked by viewport width. The layout uses rem units throughout, but it
   hasn't been checked with browser text-size settings.
3. **Undo timing.** The role-change Undo toast lasts 6 s (it pauses on hover and focus). This is acceptable because the
   role select remains available as a permanent alternative (2.2.1).
4. **Touch targets.** They meet the 2.2 AA minimum (24 px); small buttons are 32 px, below the AAA 44 px.

## How to re-run

- Component checks: `cd frontend && npm test` (the axe checks run in CI).
- Browser audit: start the stack (`docker compose up`), then run a Playwright script that uses
  `@axe-core/playwright` against each route in both colour schemes. The script used for this audit is described in the
  Phase 3 notes; it is not committed, because it needs seeded credentials.
