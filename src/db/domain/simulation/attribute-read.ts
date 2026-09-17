import { PlayerAttributes } from '../../../api/models';

// @spec PARP-001 — never a pre-combined effective value (#179); each caller owns its own
// combination. Legacy scalar-only JSON remains readable as neutral-EV compatibility data.
export type PlayerAttributeKey =
  'contact' | 'power' | 'armStrength' | 'accuracy' | 'reaction' | 'vision' | 'discipline';

export interface AttributeRead { iv: number; ev: number; }

export const readAttribute = (
  attributes: PlayerAttributes,
  key: PlayerAttributeKey,
): AttributeRead => attributes.ivEv?.[key] ?? { iv: attributes[key], ev: 0 };
