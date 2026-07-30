const largestPowerOfTwoAtMost = (teamCount: number): number => {
  if (teamCount <= 1) return 1;

  let power = 1;
  while (power * 2 <= teamCount) {
    power *= 2;
  }

  return power;
};

const shuffleTeams = (teamIds: number[]): number[] => {
  const shuffled = [...teamIds];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

const getKnockoutRoundTeamCount = (initialTeamCount: number, round: number): number => {
  if (round < 1) throw new Error(`Invalid knockout round '${round}'`);

  const reducedPower = largestPowerOfTwoAtMost(initialTeamCount);
  const hasPlayInRound = initialTeamCount !== reducedPower;

  if (round === 1) return initialTeamCount;

  if (hasPlayInRound) {
    return reducedPower / (2 ** (round - 2));
  }

  return reducedPower / (2 ** (round - 1));
};

// @spec CUP-011
const getKnockoutRoundLabel = (initialTeamCount: number, round: number): string => {
  const teamsInRound = getKnockoutRoundTeamCount(initialTeamCount, round);

  if (round === 1 && initialTeamCount !== largestPowerOfTwoAtMost(initialTeamCount)) {
    return '1st Round';
  }
  if (teamsInRound === 2) return 'Final';
  if (teamsInRound === 4) return 'Semifinals';
  if (teamsInRound === 8) return 'Quarterfinals';

  return `Round of ${teamsInRound}`;
};

export {
  getKnockoutRoundLabel,
  largestPowerOfTwoAtMost,
  shuffleTeams,
};
