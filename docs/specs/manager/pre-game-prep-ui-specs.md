# Specs: Pre-Game Prep UI

| ID | Requirement | Status |
|---|---|---|
| PREGAME-001 | WHEN the managed club opens `/:gwId/:leagueId/game/:gameId` for one of its scheduled games THE system SHALL render that matchup's date, home/away opponent context, opponent league record, and probable pitcher, without park or weather information. | [x] → #354 |
| PREGAME-002 | WHEN the managed club opens a scheduled pre-game screen THE system SHALL embed the existing lineup editor against that game's `Lineup(gameId)` snapshot and SHALL save its complete draft through the existing game-lineup PATCH endpoint. | [x] → #354 |
| PREGAME-003 | WHEN the managed club selects "Ready to sim" for a scheduled game THE system SHALL invoke `POST /api/game/:gameId/simulate`, then render the returned completed score; IF it fails THE system SHALL retain the prep screen and show an error. | [x] → #354 |
| PREGAME-004 | IF a requested game is not scheduled for the managed club, or no managed club is selected THE system SHALL show an unavailable state and SHALL NOT expose lineup or simulation mutations. | [x] → #354 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
