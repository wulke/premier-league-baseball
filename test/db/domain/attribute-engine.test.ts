// @spec PARP-017,PARP-019 (attribute-engine IV/EV golden master)
import { AttributeDrivenSimulationEngine, SyntheticLineup } from '../../../src/db/domain';
import { PlayerAttributes } from '../../../src/api/models';

const attributes = (): PlayerAttributes => ({
  contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50,
  ivEv: {
    contact: { iv: 50, ev: 0 }, power: { iv: 50, ev: 0 }, armStrength: { iv: 50, ev: 0 },
    accuracy: { iv: 50, ev: 0 }, reaction: { iv: 50, ev: 0 }, vision: { iv: 50, ev: 0 }, discipline: { iv: 50, ev: 0 },
  },
  positions: {} as any, pitches: [],
});

const lineup = (teamId: number): SyntheticLineup => ({
  teamId,
  battingOrder: Array.from({ length: 9 }, (_, index) => ({
    playerId: teamId * 100 + index + 1,
    battingOrder: index + 1,
    fieldingPosition: index === 0 ? 'Pitcher' as const : null,
    attributes: attributes(),
  })),
  startingPitcherId: teamId * 100 + 1,
});

describe('AttributeDrivenSimulationEngine IV/EV golden master (PARP-017,PARP-019)', () => {
  // @spec PARP-017,PARP-019
  it('pins the updated seed-stable box score for real IV/EV PA reads', () => {
    const home = lineup(1);
    const away = lineup(2);
    const result = new AttributeDrivenSimulationEngine(4242).simulateGame({
      gameId: 1, homeTeam: home.teamId, awayTeam: away.teamId,
      lineups: { home, away }, matchRules: { dhEnabled: false, benchSize: 5, bullpenSize: 7, innings: 9 },
    });

    const boxScore = (playerIds: number[]) => result.playerGameStats!
      .filter(({ playerId }) => playerIds.includes(playerId))
      .reduce((total, row) => ({
        AB: total.AB + row.AB, H: total.H + row.H, R: total.R + row.R, RBI: total.RBI + row.RBI,
        HR: total.HR + row.HR, BB: total.BB + row.BB, SO: total.SO + row.SO,
      }), { AB: 0, H: 0, R: 0, RBI: 0, HR: 0, BB: 0, SO: 0 });

    expect({
      score: [result.homeTeamResult, result.awayTeamResult],
      home: boxScore(home.battingOrder.map(({ playerId }) => playerId)),
      away: boxScore(away.battingOrder.map(({ playerId }) => playerId)),
    }).toStrictEqual({
      score: [14, 4],
      home: { AB: 45, H: 18, R: 14, RBI: 14, HR: 7, BB: 4, SO: 12 },
      away: { AB: 36, H: 9, R: 4, RBI: 4, HR: 2, BB: 4, SO: 10 },
    });
  });
});
