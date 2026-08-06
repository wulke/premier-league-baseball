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

- **Grouping: by position group** — Pitchers / Catchers / Infielders / Outfielders,
  each a dense table with a count. Matches how baseball rosters are read and gives
  the page immediate shape. (Flat-table is one toggle away — react to both.)
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

1. **Starting-pitcher (SP/RP) split — can't be done in v1.** The data has no
   role / depth-chart field, so SP vs RP is **not computable client-side** from
   the flat-7. v1 lists all pitchers together. A real split belongs to a future
   lineup/depth-chart concept (→ lineup/engine map territory), not this ticket.
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
