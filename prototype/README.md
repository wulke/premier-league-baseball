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
npm run dev:refs      # MLB :3005 · FPL :3006 · EAFC :3007
```

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

Core stat columns (P W D L RF RA RD Pts — the data model) are identical across
all three; each reference adds its own app-native *furniture* (GB / Form / hero),
because that furniture is part of what makes each feel like itself. The "switch
club" control stays in every build (the token-swap requirement from #8 carries
through), expressed in each reference's idiom — a bonus signal for how
team-identity-as-atmosphere reads differently per reference.

**What to evaluate here:** the *feel* of each. Which one's density, team-color
usage, and atmosphere matches how you want PLB to read? That pick is the
**visual reference** decision. It says nothing yet about Tailwind vs MUI vs
Stitches — round 2 handles that.

### ⚠️ Don't conflate the two decisions

Round 1 is **not** "which styling library." Every round-1 build is Tailwind. If
you find yourself reacting to "I like how the table sorts" or "this feels
lighter," that's mechanism talk — park it for round 2. Here, react only to the
visual language.

---

## Round 2 — pick the styling/component approach (follows the anchor)

The four approach builds (A/B/C/D below) were the **first** pass. They rendered
identically on purpose — which surfaced the methodological error: a visual
comparison can't distinguish styling mechanisms, so there was nothing to react
to. They're parked here for the follow-up round, which will re-run a
**capability-stretching** screen (e.g. a dense sortable player-stats table + a
menu/command-palette + full per-team re-skinning) through all four, in the
visual direction chosen in round 1. The reaction becomes "which approach
handled the hard screen without fighting me."

```bash
npm run dev          # A :3001 · B :3002 · C :3003 · D :3004
```

| | A · Tailwind | B · shadcn/ui | C · MUI | D · Radix+Stitches+Heroicons |
|---|---|---|---|---|
| Token mechanism (club-switch re-theme) | CSS var + config map | CSS vars (full theme) | JS `createTheme` | `createTheme` className |
| Built-in data grid | no | no | **DataGrid** (sort/density/filter/export) | no |
| Bundle (built) | ~200 KB | ~38 KB | **~782 KB** | ~24 KB |
| React 19 mount | ✓ | ✓ | ✓ | ✓ |

**Findings from building round 2 (carry into the follow-up):**
1. **D runs fine on React 19** — Stitches' React-19 reputation did *not* show up; the one crash was an import typo. So "Stitches won't run here" is not a blocker; unmaintained-since-2022 is the separate, open question.
2. **The `radix-ui` umbrella needs a version pin under Parcel 2** — floating it pulled primitives whose `@radix-ui/primitive` conditional export Parcel can't resolve (build failure). Pinned to `radix-ui@1.1.2` + `@radix-ui/primitive@1.1.1`. Individual `@radix-ui/react-*` packages (what shadcn expects) sidestep this.
3. **Stitches `$token` only resolves inside `styled()`/`css()`**, not plain inline `style={{}}` — felt in a table full of per-cell tone variants.
4. **MUI's DataGrid is the only option that delivers #8's "opt-in density" for free** (density toggle, sort, filter, export) — but at ~782 KB and the most opinionated theming.

---

## Run / verify

```bash
npm install
npm run dev:refs    # round 1: the three visual references (the current decision)
npm run dev         # round 2: the four approach builds (parked for follow-up)
npm run build       # builds all seven to dist/
node smoke.mjs <dist-relative-path>   # e.g. references/mlb  or  tailwind  or  mui
```

`smoke.mjs` jsdom-mounts a built bundle to confirm it renders under React 19.
All seven build, mount, and serve over HTTP.

## Structure

```
prototype/
  shared/          mock standings + team-identity tokens (shared by all builds)
  references/
    mlb/           round 1 — MLB app dark
    fpl/           round 1 — FPL dark
    eafc/          round 1 — EA Sports FC hub
  tailwind/        round 2 — option A
  shadcn/          round 2 — option B (Radix + Tailwind + CSS-var tokens)
  mui/             round 2 — option C (DataGrid)
  stitches/        round 2 — option D (your existing chosen stack)
  smoke.mjs        jsdom mount check
```
