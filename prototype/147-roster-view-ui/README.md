# Roster view UI — prototype (#147)

**Map:** [#135 — Team Roster & Player Visibility](https://github.com/wulke/premier-league-baseball/issues/135)
**Ticket:** [#147 — Roster view UI](https://github.com/wulke/premier-league-baseball/issues/147) (`wayfinder:prototype`)
**Branch:** `prototype/147-roster-view-ui` (throwaway, off `main`).

> Throwaway prototype to react to. Not wired into the app; not production code.
> The production roster view lands later, as normal LID feature work, once this
> map is clear.

## View it

Open the mockup directly in a browser — no build step:

```
open prototype/147-roster-view-ui/roster-view.html
```

It is a single self-contained HTML file with the roster rendered against a
hand-authored 26-player **fixture** that matches the `#145` `RosterPlayer`
response shape exactly:

```
{ id, givenName, familyName, countryCode, bats, throws, age, primaryPosition,
  contact, power, armStrength, accuracy, reaction, vision, discipline }
```

## What it decides (the recommended layout)

- **Grouping — three variants to flip between:**
  - **By position group** (default) — Pitchers / Catchers / Infielders / Outfielders,
    each a dense table with a count.
  - **Flat · primary** — one flat table, single `primaryPosition` badge per row.
  - **Flat · FM** — one flat table with a **positions-coverage cell** (Football
    Manager style): multi-position players surface all their positions (`LF CF RF`,
    `1B 3B`, `C 1B`), primary bolded, secondaries dimmed. Better for *roster
    management* because baseball players are genuinely multi-positional.
  - The FM and grouped views answer different jobs; the recommended default is **Flat · FM**
    (matches FM; the positions cell *is* the organizer), with grouping as an optional toggle.
- **Ratings: 7 compact columns with a percentile tint** (Baseball-Savant-style
  low→red, high→green), **no stored/computed OVR** — honours #145's additive
  constraint. A "Display OVR" toggle computes a **display-only** mean so you can
  feel the alternative; the API never carries one.
- **Sort:** position (default) · name · age · display-OVR — all client-side from
  fields already in the response (per #145, the API returns unsorted `Player.id`
  order; sort is the UI's job, owned by this ticket).
- **Filter:** by position group.
- **Row → player detail:** player name links to `/:gwId/player/:playerId` (the
  single link origin settled by #149).
- **Aesthetic:** the shipping app's inline-style, light, dense data-table look
  (`team-calendar.tsx` / `league.tsx`) — **not** the throwaway MLB-dark Tailwind
  references on `prototype/ui-styling` (#2/#9), which are a separate,
  not-yet-adopted visual-direction effort. Layout ideas (percentile tint, roster
  card shape) borrowed from MLB / Baseball Savant; rendered in the live app style.

## Live toggles (compare the open decisions)

The toolbar lets you flip each decision in place:

| Control | Options |
|---|---|
| Grouping | By position · Flat table |
| Ratings  | 7 columns · Display OVR |
| Sort     | Position · Name · Age · Display OVR |
| Filter   | All · Pitchers · Catchers · Infielders · Outfielders |

## Open sub-questions this surfaces (for the grilling)

1. **⚠ Surfaced dependency on [#145](https://github.com/wulke/premier-league-baseball/issues/145) — a CLOSED ticket.**
   FM-style (positions-coverage cell) is **not buildable on today's roster API**: #145's
   row ships only the single derived `primaryPosition` (argmax); the full 9-key `positions`
   map was deliberately deferred to player detail (#146). An FM roster view needs a
   **positions-coverage field added to the row** — server-derived from the `positions` map
   (e.g. the set of positions at/above a competence threshold), with full *scores* still on
   #146 detail. This is additive (identity-ish, not a synthetic rating) and consistent with
   #145's additive constraint. **Resolving #147 in favour of FM graduates a small amendment
   back onto #145's territory** — recorded as a map consequence at resolution time.
2. **Starting-pitcher (SP/RP) split — can't be done in v1.** The data has no
   role / depth-chart field, so SP vs RP is **not computable client-side** from
   the flat-7. v1 lists all pitchers together. A real split belongs to a future
   lineup/depth-chart concept (→ lineup/engine map territory, [#138](https://github.com/wulke/premier-league-baseball/issues/138)), not this ticket.
   *(The lineup/team-sheet view itself is its own future map — #138 — correctly out of scope here.)
2. **7 columns vs a display OVR** for the list — react to the toggle. Recommendation:
   ship the 7 (honest, additive); let a display OVR graduate only if the scan
   feels heavy in practice.
3. **Country presentation** — bare ISO-2 code in the fixture; real version would
   show a flag emoji or flag image. Minor; deferred to production.
4. **DH / two-way players** — `DH` is not among the 9 modelled positions, so
   Ohtani is filed under his fielding position (LF). Whether a DH slot exists is
   a schema question outside this map.

## Fixture

26 players hand-authored for realistic shape (13 P / 2 C / 6 IF / 5 OF), varied
baseball countries (US, DO, VE, PR, JP, MX) and plausible 1–100 ratings. Names
are illustrative — the real identity generator is #143.
