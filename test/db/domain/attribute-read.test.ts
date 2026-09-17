import { readAttribute } from '../../../src/db/domain';
import { PlayerAttributes } from '../../../src/api/models';

// @spec PARP-001 (attribute-read seam — unit level)
// Gherkin pairing: none — see docs/specs/game-simulation/attribute-driven-pa-resolution-specs.md
// Traceability ("PARP-001 ... routed to unit tests instead").

const attributes: PlayerAttributes = {
  contact: 42, power: 77, armStrength: 13, accuracy: 90, reaction: 55, vision: 61, discipline: 8,
  positions: {} as any, pitches: [],
};

describe('readAttribute (PARP-001)', () => {
  it('returns the raw stored scalar as iv, with ev always 0', () => {
    (['contact', 'power', 'armStrength', 'accuracy', 'reaction', 'vision', 'discipline'] as const).forEach((key) => {
      expect(readAttribute(attributes, key)).toStrictEqual({ iv: attributes[key], ev: 0 });
    });
  });

  it('never pre-combines — each read is independent of every other attribute on the same Player', () => {
    const contactRead = readAttribute(attributes, 'contact');
    const powerRead = readAttribute(attributes, 'power');
    expect(contactRead.iv).toBe(42);
    expect(powerRead.iv).toBe(77);
    expect(contactRead.ev).toBe(0);
    expect(powerRead.ev).toBe(0);
  });
});
