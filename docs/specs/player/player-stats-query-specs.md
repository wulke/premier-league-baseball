# Specs: Player Stats Query

| ID | Requirement | Status |
|---|---|---|
| PSTATQ-001 | WHEN season player stats are requested THE system SHALL aggregate the player's current-year PlayerGameStats in the database and derive rates server-side. | [ ] → #139 |
| PSTATQ-002 | WHEN career or last-10 player stats are requested THE system SHALL aggregate the applicable PlayerGameStats rows in the database and derive rates server-side. | [ ] → #139 |
| PSTATQ-003 | WHEN no applicable PlayerGameStats rows exist THE system SHALL return no summary so the UI can show “No stats recorded yet”. | [ ] → #139 |
| PSTATUI-001 | WHEN the player selects the Stats tab THE system SHALL show batting and pitching summaries for the selected grain or the empty state. | [ ] → #139 |
