# #143 — Identity generation (prototype)

**Wayfinder ticket:** [#143 — Identity generation](https://github.com/wulke/premier-league-baseball/issues/143)
**Parent map:** [#135 — Team Roster & Player Visibility](https://github.com/wulke/premier-league-baseball/issues/135)
**Branch:** `prototype/143-identity-generation` — **THROWAWAY.** Not production code.

This is a **rough generator to react to**, per the prototype ticket. It makes the
realism *visible* — names, international flavor, Caribbean distinctness — **before
any UI exists**, so the open generation decisions can be judged against actual
output rather than in the abstract. It does **not** touch the `Player` schema or
the real `generateRoster()` (the #141 column migration + wiring land in a later
LID pass; "plan, don't do").

## What's baked in (from closed tickets — not re-litigated)

- **Field set (#141):** `givenName`, `familyName`, `countryCode` (ISO-a2), `bats`
  (`L|R|S`), `throws` (`L|R`), `birthDate`. `displayName` = `given + ' ' + family`,
  derived, never stored.
- **Approach (#142):** curated static pools per country, **no faker dep**; pick
  `countryCode` **first** (weighted), then draw names from that country's pool →
  name & country consistent by construction; `bats`/`throws` **independent**
  random draws, **no** country correlation.
- **League-composition-driven (#143, for global-league support):** nationality
  weights are a property of the **league**, never a global constant. `pools.ts` is
  a shared REGISTRY of countries + name pools; `compositions.ts` holds named
  league weight-vectors (`PREMIER_LEAGUE`, `KBO`, `NPB`). The generator takes a
  composition, so the same pools/generator serve MLB-style, KBO, NPB, or any
  future league — only the weights change.

## Run it

```bash
npx ts-node --transpile-only prototype/143-identity-generation/dump.ts
# → writes to stdout; sample-output.md is a captured run (seed 143, reproducible)
```

`dump.ts` prints (a) one sample team roster and (b) an 8-team league distribution
(country / handedness / age) next to the intended weights.

## Files

- `pools.ts` — `COUNTRIES` REGISTRY: `{ code, display, flag, given[], family[] }`
  (no weights — league-agnostic name pools).
- `compositions.ts` — named league weight-vectors (`PREMIER_LEAGUE`, `KBO`, `NPB`).
- `generate.ts` — `makeRng` (mulberry32, injectable/seedable), `generateIdentity`.
- `dump.ts` — the CLI dump.
- `sample-output.md` — the captured artifact to react to.

## Open decisions this artifact exists to judge

These are the #143 decisions still open (the *tunables*, not the structure):

1. **Country weights are per-league, not global.** `pools.ts` is a shared
   REGISTRY (countries + name pools, no weights); `compositions.ts` holds named
   league weight-vectors (`PREMIER_LEAGUE`, `KBO`, `NPB`). The generator takes a
   composition → league-agnostic. Tune the `PREMIER_LEAGUE` preset (US @ 55% /
   Caribbean-core) to taste; add presets as new leagues arrive. Long tail
   (BR/PA/CO/NI… + European for a Euro league) is **omitted** — adding countries
   = adding registry entries + pools (no schema cost).
2. **Pool sizes** — ~30 given + ~30 family per country. Repetition is already
   visible at team scale (e.g. 3× *Soriano* on the sample team). Grow to ~100–200
   each? (No schema cost — just data.)
3. **Gender handling** — pools are male-only (baseball rosters are male). Keep
   male-only, or maintain gendered/gender-neutral pools? (Affects `givenName`
   lists only; `bats`/`throws`/`countryCode` are gender-independent.)
4. **`birthDate` age band** — fixed 18–38. Tune endpoints? (Skew younger? Cap at
   40 for the occasional veteran?)
5. **`bats`/`throws` distributions** — R .70 / L .25 / S .05 and R .75 / L .25.
   Tune, or leave as-is?

> Structure is stable — none of these change the schema (#141) or the
> "pick country → draw name" shape (#142); only pool contents, composition
> weights, or sampler numbers.
