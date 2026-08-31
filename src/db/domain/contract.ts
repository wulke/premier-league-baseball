import { Op, Transaction } from 'sequelize';
import db from '../client';
import { DomainError } from './errors';
import { PlayerFactory, resolveCurrentContract } from './player';
import { LineupFactory } from './lineup';

// @spec PCON-010
const MIN_ROSTER_SIZE = 20;

// @spec PCON-010
const MAX_ROSTER_SIZE = 30;

// @spec XFER-020,XFER-021 — one shared anchor; generateRoster() and Sign/Renew's
// default-endDate derivation both read these two constants.
const SEASON_END_MONTH = 9; // October, 0-indexed
const SEASON_END_DAY = 31;

const toDateOnly = (value: Date | string): Date => {
  const iso = typeof value === 'string' ? value : value.toISOString();
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const isoDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

// @spec XFER-020 — a from-date on/after November targets next season's year.
const defaultSeasonEnd = (fromDate: Date, gameWorldYear: number): Date => {
  const seasonYear = fromDate.getUTCMonth() >= 10 ? gameWorldYear + 1 : gameWorldYear;
  return new Date(Date.UTC(seasonYear, SEASON_END_MONTH, SEASON_END_DAY));
};

interface ContractRecord {
  id: number;
  playerId: number;
  teamId: number;
  startDate: string;
  endDate: string;
}

interface MutationContext {
  currentDate: string;
  gameWorldYear: number;
  gameWorldId: number;
}

interface IContract {
  sign: (context: MutationContext & { endDate?: string }) => Promise<ContractRecord>;
  release: (context: MutationContext) => Promise<{ playerId: number; teamId: number }>;
  renew: (context: MutationContext & { endDate?: string }) => Promise<ContractRecord>;
}

const toContractRecord = (contract: any): ContractRecord => {
  const values = contract.dataValues ?? contract;
  return {
    id: values.id,
    playerId: values.playerId,
    teamId: values.teamId,
    startDate: isoDate(values.startDate),
    endDate: isoDate(values.endDate),
  };
};

// @spec XFER-001 is enforced by the caller (handlers.ts) before any of these are invoked —
// every method here assumes `currentDate` is already known-non-null.
const ContractFactory = (teamId: number, playerId: number): IContract => {
  return {
    // @spec XFER-002,XFER-003,XFER-007,XFER-012,XFER-013,XFER-020
    sign: async ({ currentDate, gameWorldYear, gameWorldId, endDate }) => {
      const transaction = await db.transaction();
      try {
        const player = await db.models.Player.findByPk(playerId, { transaction });
        if (!player || player.dataValues.gameWorldId !== gameWorldId) throw new DomainError('Not found', 404);

        const existingContracts = await db.models.Contract.findAll({ where: { playerId }, transaction });
        const current = resolveCurrentContract(existingContracts, currentDate, gameWorldYear);
        if (current !== null) throw new DomainError('player is not a free agent', 422);

        const start = toDateOnly(currentDate);
        const end = endDate ? toDateOnly(endDate) : defaultSeasonEnd(start, gameWorldYear);
        if (end < start) throw new DomainError('endDate must be on or after the effective date', 422);

        const contract = await db.models.Contract.create(
          { playerId, teamId, startDate: start, endDate: end },
          { transaction },
        );
        // @spec XFER-013 — Player-owned setter, not a direct db.models.Player write
        // (backend-standards §1 model-ownership boundary).
        await PlayerFactory(playerId).setTeam(teamId, { transaction });
        await LineupFactory().repairActive(teamId, player.dataValues.gameWorldId, { transaction });

        await transaction.commit();
        return toContractRecord(contract);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },

    // @spec XFER-004,XFER-014,XFER-015,XFER-016,XFER-017
    release: async ({ currentDate }) => {
      const transaction = await db.transaction();
      try {
        const current = await db.models.Contract.findOne({
          where: {
            playerId,
            teamId,
            startDate: { [Op.lte]: currentDate },
            endDate: { [Op.gte]: currentDate },
          },
          transaction,
        });
        if (!current) throw new DomainError('team has no current contract for this player', 422);

        const closeDate = addDays(toDateOnly(currentDate), -1);
        await db.models.Contract.update(
          { endDate: closeDate },
          { where: { id: current.dataValues.id }, transaction },
        );
        // Only THIS team's not-yet-started rows — another team's history is never touched.
        await db.models.Contract.destroy({
          where: { playerId, teamId, startDate: { [Op.gt]: currentDate } },
          transaction,
        });

        const player = await db.models.Player.findByPk(playerId, { transaction });
        if (!player) throw new DomainError('Not found', 404);
        // @spec XFER-017 — Player-owned setter, not a direct db.models.Player write.
        await PlayerFactory(playerId).setTeam(null, { transaction });
        await LineupFactory().repairActive(teamId, player.dataValues.gameWorldId, { transaction });

        await transaction.commit();
        return { playerId, teamId };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },

    // @spec XFER-005,XFER-006,XFER-007,XFER-018,XFER-019
    renew: async ({ currentDate, gameWorldYear, endDate }) => {
      const transaction = await db.transaction();
      try {
        const current = await db.models.Contract.findOne({
          where: {
            playerId,
            teamId,
            startDate: { [Op.lte]: currentDate },
            endDate: { [Op.gte]: currentDate },
          },
          transaction,
        });
        if (!current) throw new DomainError('team has no current contract for this player', 422);

        const successorStart = addDays(toDateOnly(current.dataValues.endDate), 1);
        const overlap = await db.models.Contract.findOne({
          where: {
            playerId,
            startDate: { [Op.lte]: successorStart },
            endDate: { [Op.gte]: successorStart },
          },
          transaction,
        });
        if (overlap) throw new DomainError('a contract already covers the renewal start date', 422);

        const end = endDate ? toDateOnly(endDate) : defaultSeasonEnd(successorStart, gameWorldYear);
        if (end < successorStart) throw new DomainError('endDate must be on or after the renewal start date', 422);

        const successor = await db.models.Contract.create(
          { playerId, teamId, startDate: successorStart, endDate: end },
          { transaction },
        );
        // No Player.teamId change, no lineup repair — team membership is unchanged by a renewal.

        await transaction.commit();
        return toContractRecord(successor);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
  };
};

// @spec XFER-008 — GameWorld-wide (Player/Contract/Team are GameWorld children, not League
// children), idempotent (only writes where teamId actually differs), called from
// LeagueFactory(id).cutover() inside its own transaction.
const reconcileTeamMemberships = async (
  gameWorldId: number,
  currentDate: string | undefined,
  gameWorldYear: number,
  transaction: Transaction,
): Promise<void> => {
  const players = await db.models.Player.findAll({
    where: { gameWorldId },
    include: [{ model: db.models.Contract }],
    transaction,
  });

  for (const player of players) {
    const values = player.dataValues;
    const current = resolveCurrentContract(values.Contracts ?? [], currentDate, gameWorldYear);
    const currentValues = current?.dataValues ?? current;
    const correctTeamId = currentValues?.teamId ?? null;
    if (values.teamId !== correctTeamId) {
      await PlayerFactory(values.id).setTeam(correctTeamId, { transaction });
    }
  }
};

// @spec XFER-022 — Contract-owned read: TeamFactory.getRoster() calls this instead of the
// Team↔Contract association (backend-standards §1 — that association-traversal read
// belongs to a Factory reading a model it doesn't own via its own PK; now that
// ContractFactory owns Contract, a whole-team Contract read is this Factory's to expose).
const listForTeam = async (teamId: number, options: { transaction?: Transaction } = {}): Promise<any[]> => {
  return db.models.Contract.findAll({
    where: { teamId },
    include: [{ model: db.models.Player }],
    transaction: options.transaction,
  });
};

export {
  ContractFactory,
  listForTeam,
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  SEASON_END_MONTH,
  SEASON_END_DAY,
  defaultSeasonEnd,
  reconcileTeamMemberships,
};
