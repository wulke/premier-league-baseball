// @spec PARP-007 — mirrors #224's settled envelope schema exactly. This is the smallest
// types-only slice of the events/ module #191 needs; the registry, gradeGame, and durable
// persistence described in docs/high-level-design-event-grading-reward.md are out of scope
// here (see docs/llds/game-simulation/attribute-driven-pa-resolution.md — Scope).
export interface EventEnvelope<TContext> {
  type: string;
  gameId: number;
  sequence: number;
  causedByEventId: number | null;
  context: TContext;
}
