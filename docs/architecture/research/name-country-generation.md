# Research: Name / Country Generation Approaches

**Wayfinder ticket:** [#142 — Name/country generation approaches](https://github.com/wulke/premier-league-baseball/issues/142)
**Parent map:** [#135 — Team Roster & Player Visibility](https://github.com/wulke/premier-league-baseball/issues/135)
**Branch:** `research/name-country-generation` (throwaway — research findings only; no production code)
**Status:** Findings to feed the identity-generation **prototype** ticket [#143](https://github.com/wulke/premier-league-baseball/issues/143) (blocked by this one).

---

## Context — what this feeds

Decision [#141](https://github.com/wulke/premier-league-baseball/issues/141) already settled **6 typed identity columns** on `Player`, all `allowNull:false`:

| column        | meaning                                   |
| ------------- | ----------------------------------------- |
| `givenName`   | first name (string)                       |
| `familyName`  | last name (string)                        |
| `countryCode` | ISO 3166-1 alpha-2 origin (e.g. `US`, `DO`) |
| `bats`        | batting hand (`L` / `R` / `S`)            |
| `throws`      | throwing hand (`L` / `R`)                 |
| `birthDate`   | aging-immune seed (not a stored `age`)    |

Identity is produced **server-side**, inside `PlayerFactory.generateRoster()` (`src/db/domain/player.ts`), which today `bulkCreate`s N players with only `{ teamId, gameWorldId, attributes }`. The prototype (#143) extends that to populate the 6 columns above.

This research surfaces the facts #143 needs to decide **how** to fill `givenName` / `familyName` / `countryCode`, and **whether `bats`/`throws` should correlate with country**. It is a facts-and-recommendation doc, not a build spec.

---

## A. `@faker-js/faker` — locale coverage for baseball's international skew

`@faker-js/faker` v10.5.0 (MIT). Ships **70+ locales**; each pre-built instance is independently importable (`import { fakerEN_US, fakerES_MX, fakerJA, fakerKO } from '@faker-js/faker'`) and the unused ones are tree-shakeable. The main `faker` instance defaults to English.

**Baseball-country coverage, verified against the v10 source (`src/locales/`):**

| Baseball country      | faker locale | Own first/last-name pool?              | Verdict |
| --------------------- | ------------ | -------------------------------------- | ------- |
| United States         | `en` / `en_US` | `en` is enormous (~3185 first names); `en_US` inherits person from `en` and only overrides location/phone | ✅ excellent |
| Canada (English)      | `en_CA`      | own pool                               | ✅ good |
| Canada (Québécois)    | `fr_CA`      | own pool                               | ✅ good (if you want French-Canadian flavor) |
| Mexico                | `es_MX`      | **own** pool — 300 first names, **687** surnames, distinct from generic `es` (625) | ✅ good |
| Brazil                | `pt_BR`      | own pool                               | ✅ adequate |
| Japan                 | `ja`         | 279 first names, own surnames          | ✅ good |
| Korea                 | `ko`         | 540 first names, own surnames          | ✅ good |
| Taiwan                | `zh_TW`      | own pool                               | ✅ adequate |
| **Dominican Republic** | `es` only    | ❌ **no `es_DO`**                       | ⚠️ collapses (see B) |
| **Puerto Rico**        | `es` only    | ❌ **no `es_PR`**                       | ⚠️ collapses |
| **Cuba**               | `es` only    | ❌ **no `es_CU`**                       | ⚠️ collapses |
| **Venezuela**          | `es` only    | ❌ **no `es_VE`**                       | ⚠️ collapses |

**So: adequate and rich for the US/Canada/Japan/Korea/Mexico/Brazil/Taiwan skew; structurally inadequate for the Caribbean Latin American baseball heartland.**

### B. The Latin American gap (the decisive fact)

DR, PR, Cuba, and Venezuela — roughly **~25-30% of real MLB rosters combined** — have **no dedicated faker locale**. They all draw from the single generic **`es`** pool. Two problems follow:

1. **They are indistinguishable from each other.** A "Dominican" and a "Venezuelan" generated via `es` are sampled from the *identical* name lists — no national character at all.
2. **`es` is Spain-leaning, not Caribbean.** The generic `es` first-name list includes Catalan/Spain-specific markers (`Carles`, `Jordi`, `Sergi`, `Josep`, `Roser`) that read as *Spanish (Spain)*, not Latin American. So generated "Dominicans" don't just look generic — they can look specifically wrong.

`es_MX` is genuinely Mexican (its own surname list of 687), but that's only Mexico. The Caribbean four are simply absent from faker-js.

> **Bottom line:** using faker-js *alone* fails the destination's own bar — "rosters show *people*, not anonymous rating-bundles" with an "international" flavor — specifically at the countries where international baseball flavor is most visible.

### C. Architecture note — bundle size is a non-issue here

The ticket asks about "bundle-size vs quality." For **this** codebase the concern is largely moot:

- Name generation runs **server-side** in `generateRoster` (a DB write during team creation). It never ships to the browser.
- The Parcel/UI bundle only grows if name *generation* moves client-side, which it does not (it's a write, and writes are out of scope — see map Notes).
- Node-side, importing a handful of faker locale instances (e.g. `fakerEN_US`, `fakerES_MX`, `fakerJA`, `fakerKO`) is tree-shakeable and costs a runtime dependency, not a download.

So the "bundle" axis should not drive the choice. **Quality of the baseball skew** is the axis that matters, and that is exactly where faker-js is weakest (Section B).

---

## D. Curated regional name-list alternatives

If faker-js can't carry the Caribbean alone, the alternative is small **curated static name arrays** per country. Realistic free sources, with licensing caveats:

| Source | What it gives | License / access | Fit |
| ------ | ------------- | ---------------- | --- |
| **US Census Bureau** surname list (1990 / 2000) | Most common US surnames, frequency-ranked | Public domain (US Govt) | US-only; given names weak |
| **Behind the Name** ([behindthename.com](https://www.behindthename.com)) | Names tagged by *usage* (language/country); strong on etymology + nationality | Site data © ; **free read-only API** requires a key (`api.behindthename.com`); name lists usable for curation with attribution | Best source for *country-tagged* given names, incl. DR/PR/CU/VE |
| **Wikipedia** "List of …surnames" / "…given names" per country | Country-specific common-name articles | CC BY-SA | Good seed lists; watch license/attribution |
| **National civil registries** (e.g., Dominican JCE, Venezuelan INE, Mexico INEGI, Spain INE) | Official most-common-name rankings | Varies; many public | Authoritative; check per-country terms |
| Kaggle / DataHub "names by country" dumps | Pre-collected CSVs | Varies (often CC0/CC-BY) | Convenience, verify source |

**Curating is a one-time data-gathering task**, not a runtime cost. For v1 you need only ~8-10 countries (the weighted list in Section E), and per country a few hundred first + a few hundred last names is plenty to avoid visible repetition at roster scale (a league is hundreds, not millions, of players).

### Country-code mapping

`countryCode` (ISO 3166-1 alpha-2) is **the country you chose** — there is no reverse-lookup needed. You pick the origin from a weighted list (Section E), and you *generate the name from that country's pool*, so name and `countryCode` are consistent by construction. For alpha-2 ↔ display-name enrichment in the UI later, tiny libs exist (`i18n-iso-countries`, `world-countries`), but v1 can hard-code the ~10 display names.

---

## E. Mapping name → country (and the weighted country distribution)

**The direction is: pick country first, then draw a name from that country's pool.** Do *not* generate a name then try to infer its country — that is ambiguous and wrong-by-construction (e.g. `José Ramírez` exists in Spain, Mexico, DR, and PR).

A baseball-realistic v1 origin list (ISO alpha-2 → weight). These weights are a **starting point for the prototype to tune**, not a researched census:

| Code | Country             | Suggested v1 weight | Note |
| ---- | ------------------- | ------------------- | ---- |
| `US` | United States       | ~0.55               | dominant |
| `DO` | Dominican Republic  | ~0.10               | Caribbean core |
| `VE` | Venezuela           | ~0.06               | Caribbean core |
| `CU` | Cuba                | ~0.04               | Caribbean core |
| `PR` | Puerto Rico         | ~0.04               | Caribbean core |
| `MX` | Mexico              | ~0.05               | |
| `CA` | Canada              | ~0.03               | |
| `JP` | Japan               | ~0.04               | |
| `KR` | Korea               | ~0.03               | |
| `TW` | Taiwan              | ~0.01               | |
| `BR` / `PA` / `CO` / `NI` … | others | ~0.05 combined | long tail; can fold into "Other"/`es` initially |

(The exact weights are a #143 decision; the *structure* — a small `{ code, display, weight, pool }` table — is what this research recommends.)

---

## F. `bats` / `throws` — should they correlate with country in v1?

**No. Keep them independent random.** Grounding:

1. **faker-js has no handedness/sport concept at all** (confirmed: no module in `src/modules/`). So `bats`/`throws` *must* come from a custom distribution regardless.
2. **Handedness is biologically near-uniform across populations** — left-handedness occurs at ~10% in the general population worldwide, with no meaningful country skew. Baseball's elevated left-handed-batter rate (~25-30% of MLB batters are LHB, vs ~10% in the public) is a *sport-selection* effect, not a national one. So there is no principled country→hand correlation to encode.
3. A single fixed **MLB-like** distribution is both simpler and more correct than per-country tables. Reasonable v1 numbers (approximate, tune in #143):
   - **`bats`:** `R` ~0.70, `L` ~0.25, `S` (switch) ~0.05.
   - **`throws`:** `R` ~0.75, `L` ~0.25. (Switch-pitchers are vanishingly rare — exclude from v1.)
   - Optional refinement: pitchers skew slightly more R / fewer switch — but that's over-engineering for v1; a single distribution for all players is fine.
4. **`bats` vs `throws` correlation in v1:** treat as *independent* draws. The real-world correlation (e.g. almost all LHB throw L, but many RHB throw L) is a second-order effect; an independent draw is realistic *enough* for a roster's flavor and keeps the generator trivial.

---

## G. Recommendation — minimal v1

> **Curated static name pools per country; no faker-js dependency.**

1. **Pick the origin** from a small weighted table (Section E): `{ code, display, weight }` for ~8-10 baseball countries. Store `countryCode` as the alpha-2 code.
2. **Draw `givenName` + `familyName`** from that country's curated static arrays (TS modules, e.g. `names/do.ts`, `names/us.ts`, …), split by gender where it matters. ~100-200 first + ~150-250 last per country is ample at league scale.
3. **`bats` / `throws`**: independent random draws from the fixed MLB-like distribution in Section F. **No correlation with country, and none between the two in v1.**
4. **`birthDate`**: independent random within a plausible age band (decided in #143, since #141 already owns the field).

### Why curated lists over faker-js for v1

- **The baseball skew is the whole point**, and faker-js collapses DR/PR/CU/VE into one Spain-leaning `es` pool (Section B) — the exact failure mode the destination wants to avoid.
- Generation is **server-side**, so there is no browser-bundle benefit from faker's tree-shaking (Section C). The only "cost" faker saves is curation — and only ~8-10 small lists are needed.
- Curated arrays are **deterministic, zero-dependency, offline, and trivially testable** — they fit a write-path that should stay simple.
- The identity schema (#141) is generator-agnostic: swapping the internals later needs **no** column change.

### Cost to go richer later (explicitly flagged)

| Richness step | Cost |
| ------------- | ---- |
| More countries / longer lists | Curate more arrays; a one-time data task (sources in Section D). No schema or API change. |
| **Frequency-weighted** sampling (so `Smith`/`García` appear more than rare names) | Add a weight/frequency column to the array entries; same data sources (US Census, Behind the Name) already provide frequencies. |
| Adopt faker-js for the well-covered locales (US/JP/KR/MX/BR/TW) | `npm i @faker-js/faker`, swap those countries' pools for per-locale instances. Still need curated Caribbean pools — faker can't cover them. |
| Hand-position correlations (LHB↔throws L) | Add a tiny conditional draw; independent draws remain the fallback. |

**Nothing in the v1 recommendation precludes any of these** — the schema and the "pick country → draw name" structure are stable; only the *contents* of the pools and the sampling function change.

---

## Open questions left for #143 (the prototype)

- **Exact country weights** (Section E gives the structure + a starting table; tune against how a real roster "feels").
- **Pool sizes** per country — how many entries before repetition is invisible at league scale (a few hundred is almost certainly enough).
- **Gender handling** — generate gender first and draw gendered given names, or maintain gender-neutral pools? (Affects only `givenName` lists; `bats`/`throws`/`countryCode` are gender-independent.)
- **`birthDate` age band** — owned by #141's field decision, but the *range* (e.g. 18-38) is a #143 prototype choice.
- Whether to expose the country/name pools as a module importable by tests (recommended — keeps `generateRoster` unit-testable with seeded RNG).
