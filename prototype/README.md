# UI styling-approach prototypes — wayfinder #9

> **Throwaway.** These mini-apps exist only so the visual reference and the
> styling/component approach can be decided by reacting to real rendered UI
> (wayfinder map #2, ticket #9). They are **not** part of the shipping app and
> live on a throwaway branch (`prototype/ui-styling`). The real rebuild happens
> later, as normal LID feature work.

Same representative surface every time: the **league / standings page**, on the
same mock data (`shared/mock-data.ts`). Two rounds, sequenced — because the
visual reference and the styling mechanism are **different decisions** and
reward different evidence.

---

## Round 1 — pick the visual reference (the current decision)

#8 named a *band* — MLB app dark / FPL dark / EA Sports FC hub — and explicitly
left "which one is the anchor" to this ticket, to be chosen "by reacting to real
rendered UI, not blind." So round 1 renders the standings page **three ways**,
each faithfully channeling one app's dark-mode design language. The styling
mechanism is held **constant** (Tailwind across all three) so the only variable
is the visual reference. React to these and pick the anchor.

```bash
npm install
npm start      # builds all 7 + serves at http://localhost:4000
```

Then open **http://localhost:4000** — a landing page links to everything. The
three references for round 1:

- http://localhost:4000/references/mlb/ — MLB app dark
- http://localhost:4000/references/fpl/ — FPL dark
- http://localhost:4000/references/eafc/ — EA Sports FC hub

> **Serving model.** The references are served from the **built** output, not
> Parcel's dev server. Reason: multiple Parcel dev servers run from one project
> root cross-contaminate (every port ends up serving one entry — that's the bug
> that made them look identical), and a single multi-entry dev server falls back
> to the first entry for every URL. A static serve of the build is correct and
> reliable. If you want live-reload while editing one option, run its
> `npm run dev:<name>` script **alone** (e.g. `npm run dev:fpl`) — only one
> Parcel process at a time is safe.

| | MLB app dark | FPL dark | EA Sports FC hub |
|---|---|---|---|
| **URL** | :3005 | :3006 | :3007 |
| **Background** | near-black flat `#0B0B0D` | dark navy-charcoal `#171A24` | near-black + radial gradient/glow `#07070A` |
| **Team color** | thin 3px row left-border (restrained) | semantic — form pills, kit badges, fixture chips | large gradient blocks + hero glow (spectacle) |
| **Typography** | Roboto Condensed, tabular nums, broadcast | Inter, chip-heavy, rounded | Oswald + Archivo Black, oversized display hero |
| **Density** | high, all divisions open, strong rules | medium, gamified, rank arrows + form pills | low, big cards, whitespace, glow |
| **Signature furniture** | **GB** column (baseball-native), strong rules | PL-purple brand, color-coded status, **Form** pills | electric cyan + gold leader, gradient **hero** |
| **Switch-club idiom** | re-tints your-club row border | re-themes plum highlight + badge ring | re-themes the **hero glow** dramatically |
| **Where it sits on #8's band** | broadcast/official end | management-game end | energy/spectacle end |

A **4th reference — Baseball Savant** — is also available. It sits *outside* the
#8 band: light-themed, data-tool register (MLB navy strip, dense zebra table,
sortable headers, filter pills, the famous **percentile color scale** on Pts &
Pyth%). It's the page you asked for after the three dark options didn't land —
and it surfaces the **light-vs-dark fork** (it tensions with #8's dark-chrome
decision; see the ticket thread).

The Savant reference also has **two extra page types** to test whether the
register generalizes beyond a table:
- **Team Overview** (`/references/savant/team/?team=N`) — team-identity strip +
  record, a team-level percentile profile, and a roster linking to players.
- **Player Overview** (`/references/savant/player/?player=N`) — the iconic
  **percentile-bar profile** (10 stats as colored bars), the high-signal test.

Navigate by clicking a team name in the standings → team page → player page.

A **dark variant** of all three Savant pages lives at `/references/savant-dark/`
(and `/team/`, `/player/` under it). It shares the Savant component code
verbatim (symlinked) — only the palette inverts. It exists to settle the
**light-vs-dark fork** using a register whose structure you've already said works:
flip light ↔ dark on the same page and react only to the theme.

Core stat columns (P W D L RF RA RD Pts — the data model) are identical across
all three; each reference adds its own app-native *furniture* (GB / Form / hero),
because that furniture is part of what makes each feel like itself. The "switch
club" control stays in every build (the token-swap requirement from #8 carries
through), expressed in each reference's idiom — a bonus signal for how
team-identity-as-atmosphere reads differently per reference.

**What to evaluate here:** the *feel* of each. Which one's density, team-color
usage, and atmosphere matches how you want PLB to read? That pick is the
**visual reference** decision. It says nothing yet about Tailwind vs shadcn vs
Stitches — round 2 handles that.

### ⚠️ Don't conflate the two decisions

Round 1 is **not** "which styling library." Every round-1 build is Tailwind. If
you find yourself reacting to "I like how the table sorts" or "this feels
lighter," that's mechanism talk — park it for round 2. Here, react only to the
visual language.

---

## Round 2 — styling/component approach (DECIDED)

The styling approach was decided by **judgment, not a further prototype round**,.
after round 1's findings did enough of the work:

- **Selected:** the existing **Radix + Stitches + Heroicons** stack (`stitches/`).
  Already installed, runs cleanly under React 19 (verified — the one Stitches
  crash during the build was an import typo, not a compat issue), and the dark
  Savant token-swap was trivial in it.
- **Ruled out:** **MUI / DataGrid** — removed from this prototype entirely.
  Though its DataGrid uniquely delivered "opt-in density" for free, the weight
  (~782 KB) and opinionated theming didn't fit; the user disliked it.
- **Not pursued further:** Tailwind and shadcn remain as explored options in
  `tailwind/` and `shadcn/` for reference, but were not selected.

**Findings from the approach exploration (carried into the rebuild):**
1. **Stitches runs fine on React 19** — the reputation didn't materialize; unmaintained-since-2022 stays a known, accepted trade-off of the chosen stack.
2. **The `radix-ui` umbrella needs a version pin under Parcel 2** — floating it pulled primitives whose `@radix-ui/primitive` conditional export Parcel can't resolve (build failure). Pinned to `radix-ui@1.1.2` + `@radix-ui/primitive@1.1.1` (an `overrides` entry). Individual `@radix-ui/react-*` packages sidestep this and may be worth adopting during the rebuild.
3. **Stitches `$token` only resolves inside `styled()`/`css()`**, not plain inline `style={{}}` — a convention to hold during the rebuild.

---

## Run / verify

```bash
npm install
npm start          # build all seven + serve at http://localhost:4000 (landing page links to everything)
npm run build      # build only
npm run serve      # serve an existing dist/ on :4000
node smoke.mjs <dist-relative-path>   # e.g. references/mlb  or  tailwind  or  stitches
```

`npm run dev:<name>` (e.g. `dev:fpl`) runs Parcel's dev server for a **single**
option with live reload — but only one at a time; multiple concurrent Parcel
dev servers from this root contaminate each other (see "Serving model" above).

`smoke.mjs` jsdom-mounts a built bundle to confirm it renders under React 19.
All entries build, mount, and serve over HTTP.

## Structure

```
prototype/
  shared/          mock standings + team-identity tokens (shared by all builds)
  references/
    mlb/           round 1 — MLB app dark
    fpl/           round 1 — FPL dark
    eafc/          round 1 — EA Sports FC hub
    savant/        round 1 — Baseball Savant (light; + team/ and player/ pages)
    savant-dark/   round 1 — Baseball Savant, dark variant (same code, palette inverted)
  tailwind/        explored — option A (atomic utilities)
  shadcn/          explored — option B (Radix + Tailwind + CSS-var tokens)
  stitches/        SELECTED — Radix + Stitches + Heroicons (the chosen approach)
  index.html       landing page (links to all entries)
  serve.mjs        dependency-free static server for the built output
  smoke.mjs        jsdom mount check
```
