# UI styling-approach prototypes — wayfinder #9

> **Throwaway.** These four mini-apps exist only so the styling/component
> approach can be decided by reacting to real rendered UI (wayfinder map #2,
> ticket #9). They are **not** part of the shipping app and live on a throwaway
> branch (`prototype/ui-styling`). The real rebuild happens later, as normal
> LID feature work, once an approach is chosen.

Same representative surface rendered four ways: the **league / standings page**
— a 10-column standings table (data density), per-row team identity color
(team-identity-as-atmosphere), collapsible divisions (an interactive primitive),
and a "switch club" control that re-themes the page accent to the selected team
(the **token-swap** axis — a hard requirement from #8's visual-direction
decision). All four use the **same mock data** (`shared/mock-data.ts`) and the
**same dark chrome tokens** (`shared/tokens.ts`) from #8, so the only variable
is the styling approach.

## Run it

```bash
cd prototype
npm install
npm run dev      # lights up all four on ports 3001–3004
```

then open:

| Option | URL | Stack |
|---|---|---|
| **A — Tailwind** | http://localhost:3001 | atomic utilities |
| **B — shadcn/ui** | http://localhost:3002 | Radix + Tailwind + CSS-var tokens |
| **C — MUI** | http://localhost:3003 | `@mui/material` + `@mui/x-data-grid` |
| **D — Radix + Stitches + Heroicons** | http://localhost:3004 | your existing chosen stack |

(`npm run build` builds all four to `dist/`; `node smoke.mjs <opt>` jsdom-mounts
an option's bundle to confirm it renders under React 19.)

React 19 + Parcel 2 stay fixed (per map Notes). Each option is a self-contained
Parcel entry with its own config, so they don't interfere.

## What each demonstrates (the token-swap mechanism — the #8 requirement)

Every option implements the *same* "switch club → re-theme accent" behaviour,
but via its **native** token mechanism. That difference is the point of the round.

- **A · Tailwind** — identity accent is a CSS custom property; `tailwind.config`
  maps the `accent` token to `var(--accent)`. Switching clubs = setting two CSS
  vars. Chrome palette is static in the config.
- **B · shadcn/ui** — the whole theme is CSS variables (`--background`,
  `--primary`, …); Tailwind tokens reference them via `hsl(var(--…))`. Switching
  clubs = swapping `--primary`. This is the canonical shadcn theming model and
  the most direct expression of "token-swappable by construction."
- **C · MUI** — the theme is a JS object (`createTheme`); switching clubs =
  rebuilding the theme with a new `palette.primary.main` and re-applying it via
  `ThemeProvider`. The DataGrid also ships a **density toggle** (compact /
  standard / comfortable) + sorting + filtering + export for free — MUI's
  whole pitch for a data-heavy management app.
- **D · Radix + Stitches + Heroicons** — tokens live in `createStitches()`;
  each club is a `createTheme()` that returns a className applied to the root.
  Styled components via `styled()`; Collapsible via Radix; chevron via Heroicons.

## Neutral comparison (facts only — the verdict is yours)

| | A · Tailwind | B · shadcn/ui | C · MUI | D · Radix+Stitches+Heroicons |
|---|---|---|---|---|
| Token mechanism | CSS var + config map | CSS vars (full theme) | JS theme object | `createTheme` className |
| Built-in data grid | no (hand-rolled table) | no (hand-rolled) | **yes — DataGrid** (sort/density/filter/export) | no (hand-rolled) |
| Accessible primitives | hand-rolled here | Radix (Collapsible) | native (Accordion) | Radix (Collapsible) |
| Bundle (built) | ~200 KB JS + 7 KB CSS | ~38 KB JS + 8 KB CSS | **~782 KB JS** | ~24 KB JS (runtime CSS) |
| Reuses your installed deps | — | **radix-ui ✓** | — | **radix-ui ✓, stitches ✓, heroicons ✓** |
| React 19 (runtime mount) | ✓ | ✓ | ✓ | ✓ |

## Findings worth reacting to (surfaced while building — not a verdict)

1. **Option D works under React 19.** Stitches' reputation for React-19 trouble
   did not show up here — all four mount cleanly in a jsdom render (verified by
   `smoke.mjs`). The one runtime crash during the build was *my* import typo,
   not Stitches. So the "Stitches is dead / won't run on React 19" concern is
   *not* a blocker on its own merits — the maintenance/abandonment question is
   separate and still yours to weigh.
2. **The `radix-ui` umbrella + Parcel 2 needs a version pin.** Floating
   `radix-ui` pulled primitives that use a newer `@radix-ui/primitive`
   conditional export Parcel can't resolve → build failure. Pinned to the same
   `radix-ui@1.1.2` + `@radix-ui/primitive@1.1.1` the main repo already uses
   (via an `overrides` entry). If the project stays on the umbrella, this pin
   should be explicit; the cleaner long-term move most teams adopt is the
   individual `@radix-ui/react-*` packages (which is what shadcn expects).
3. **Stitches `$token` substitution only works inside `styled()`/`css()`**,
   not in plain React inline `style={{}}`. Any dynamic, conditionally-styled
   element has to use resolved literals inline (or be promoted to a styled
   component). Noticeable in a table full of per-cell tone variants.
4. **MUI's value prop is real but heavy.** The DataGrid gives you the whole
   "data-first, opt-in density" UX from #8 out of the box — but at ~782 KB and
   with the most opinionated theming model (least like the others).
5. **Tailwind + shadcn are the closest cousins** (shadcn is Radix + Tailwind +
   CSS vars). If the shortlist narrows to these two, the real question becomes
   "do we want pre-built accessible components (B) or build them ourselves (A)?"

## Open forks for the decision (the ticket doesn't resolve itself)

These are yours to call after reacting to the running prototypes:

- Which approach (or pair) survives the reaction?
- Built-in DataGrid (C) vs. hand-rolled tables (A/B/D) — is MUI's data-grid
  density worth its weight and opinions for *this* app?
- Component-library posture: own your markup + utilities (A), copy-in
  components on Radix (B), full library (C), or styled-primitive layer (D)?
- Does the maintenance status of Stitches (unmaintained since 2022) outweigh
  that it's already installed and works — i.e. is D a finish-what-we-started
  choice or a sunk-cost one?

## Structure

```
prototype/
  shared/        mock standings + the dark chrome tokens from #8 (shared by all)
  tailwind/      option A
  shadcn/        option B  (lib/utils.ts cn helper, components/ui/* copy-ins)
  mui/           option C
  stitches/      option D  (stitches.config.ts tokens + createTheme per club)
  smoke.mjs      jsdom mount check (one option per process)
```
