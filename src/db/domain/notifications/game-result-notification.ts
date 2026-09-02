import { registerNotificationType } from './registry';

// Concrete notification type, registered from game.ts's completion path — not defined
// inside the generic notifications module (backend-standards module-placement
// precedent, ratified in #261).
const GAME_RESULT = 'GAME_RESULT';

interface GameResultPayload {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamResult: number;
  awayTeamResult: number;
}

// @spec NOTIF-011 — registered at module load, before any GameFactory.simulate() call
// can fire it (game.ts imports this module for its side effect).
registerNotificationType(GAME_RESULT);

export { GAME_RESULT, GameResultPayload };
