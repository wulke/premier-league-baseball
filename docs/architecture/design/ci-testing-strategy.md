# CI Testing Strategy

Status: Proposed (rollout sequence below)
Date: 2026-09-22

## Problem

Agents validated every change by running the full Jest suite locally. On the dev
machine (8 cores / 16 GB) a full run costs **~3.5 min wall and full-core
saturation** (~295 s CPU across workers), making the workstation unusable during
agent sessions. Measurements:

| Suite | Tests | Wall | CPU |
|---|---|---|---|
| UI (`jsdom`, 27 suites) | 217 | 19.3 s | 90.6 s |
| Backend BDD (21 suites) | 200 | 186 s | 204 s |
| Full `npm test` | ~417 | ~210 s | all cores |

Note: the perceived "UI suite" cost is mostly the *backend BDD* suite — 10× the
UI suite's wall time — because agents run `npm test` (both projects).

## Decision

Tiered validation; the full suite becomes a **CI-only** required check
(GitHub-hosted runners), local runs are bounded and targeted:

| Tier | Command | Where | Cost |
|---|---|---|---|
| 0 | `npm run typecheck` | local, every change | seconds |
| 1 | `npm run test:affected` (`jest --findRelatedTests` vs `origin/main`) | local, every change | seconds–~30 s |
| 2 | full suite — jobs `typecheck` / `backend-tests` / `ui-tests` | GitHub Actions, required PR checks | GitHub's resources |

- Workflow: `.github/workflows/ci.yml` (Node 22, `setup-node` npm cache, Jest
  cache via `actions/cache`, `--maxWorkers=2`, concurrency-cancel on superseded runs).
- The agent-facing policy lives in `CLAUDE.md` ("Testing Protocol") — agents are
  the primary repeat offender, so the policy is written for them explicitly.
- Rationale for not going "CI-only, no local tests": a CI round trip is 3–10 min;
  agents with no local signal iterate ~10× slower and burn context windows. Tier 1
  keeps a fast inner loop while Tier 2 catches integration regressions off-machine.

## Rollout sequence

1. **Restore green on `main`** (required checks on a red `main` train everyone to
   bypass the gate). Status:
   - ✅ `roster-read-api` (8 tests) — fixed: fixture now creates a container
     League and passes `homeLeagueId` (NOT NULL since per-League team ownership,
     commit `8ccaaa0`, PR #286/#283; the Red commit `675f85e` landed 5 min before
     the Green schema change and the fixture was never cascaded).
   - ❌ `season-calendar-lifecycle` (2 tests) — broken by `8ccaaa0`. The SCL-012
     legacy-migration scenarios build a legacy schema via SQLite
     `removeColumn('Leagues', 'status'/'year')`, which Sequelize implements as a
     table **recreate**; under the post-#283 schema the re-`sync` at test setup
     fails (SQLite error surfaced through `Sequelize.sync → dropTable`). Fix
     direction: construct legacy state without `removeColumn` (e.g. separate
     minimal table or raw `CREATE TABLE` + `ALTER`), or gate the fixture on the
     migration's column detection only.
   - ❌ `player-game-stats-writer` (suite OOM) — regression after `b9a77ed`
     (passed 7/7 in 5 s there; OOMs at HEAD during `GameFactory.simulate`).
     Root cause (repro'd): the fixture's players carry
     `attributes: { positions: {}, pitches: [] }`; `readAttribute` returns
     `iv: undefined` for missing ratings; `resolvePA`'s weights become `NaN`,
     so `roll < cumulative` is always false and the `'HR'` fallback fires on
     **every** plate appearance — outs never accrue, `while (outs < 3)`
     (`src/db/domain/simulation/attribute-engine.ts`) never exits, and the
     event chain grows until the heap dies. This is a domain robustness bug,
     not just a fixture bug: any production game with one ratings-less player
     would hang the server. Per LID, fix intent first: add an EARS row (e.g.
     PARP-0xx "WHEN a lineup participant lacks simulation attributes THE engine
     SHALL fail fast with a domain error / treat missing ratings as neutral")
     then cascade: guard in `resolvePA` or `readAttribute`, and give the fixture
     real ratings.
2. Merge the CI workflow **non-required**; confirm green on a PR.
3. Branch protection on `main`: require `typecheck`, `backend-tests`, `ui-tests`;
   require branches up to date; require PRs (no direct pushes) — otherwise agents
   push straight to `main` and the gate never engages.

## Agent protocol (summarized; authoritative copy in CLAUDE.md)

- Tier 0 + Tier 1 before every commit; single-file jest while iterating.
- Never run the full suite locally. After pushing, PR checks are authoritative;
  on CI failure reproduce locally with only the failing file(s).
- `--maxWorkers=50%` if the machine feels sluggish.
