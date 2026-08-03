# Specs: GameWorld Deletion (UI)

Frontend requirements for the home page's per-card GameWorld delete affordance and its
confirmation modal.

| ID | Requirement | Status |
|---|---|---|
| GWDUI-001 | WHEN a user hovers a GameWorld card on the home page with a mouse THE system SHALL reveal a delete ("[x]") icon in the card's top-right corner | [x] → #100 |
| GWDUI-002 | WHEN a user clicks a card's delete icon THE system SHALL prevent that click from also triggering the card's navigate-to-game-world action | [x] → #100 |
| GWDUI-003 | WHEN a user clicks a card's delete icon THE system SHALL open a confirmation modal naming the GameWorld and stating the deletion is permanent | [x] → #100 |
| GWDUI-004 | WHEN a user clicks Cancel in the delete confirmation modal THE system SHALL close the modal without sending any delete request | [x] → #100 |
| GWDUI-005 | WHEN a user confirms deletion IF the delete request succeeds THE system SHALL remove the GameWorld from the home page list and close the modal, without refetching the full list | [x] → #100 |
| GWDUI-006 | WHEN a user confirms deletion IF the delete request fails THE system SHALL keep the modal open, show an error message, and offer Retry and Cancel, leaving the card in the list | [x] → #100 |
| GWDUI-007 | WHEN a delete request is submitting THE system SHALL disable the modal's Delete/Retry and Cancel controls until the request settles | [x] → #100 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/game-world-deletion-ui.md`
- Backend LLD (sibling): `docs/llds/game-world-deletion.md`
- Gherkin: `test/ui/features/game-world-deletion-ui.feature`
- Code: `src/ui/pages/home.tsx` (MODIFIED), `src/ui/components/confirm-delete-modal.tsx` (NEW)
