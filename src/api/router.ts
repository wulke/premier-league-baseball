const express = require('express');
const router = express.Router();
import * as handlers from './handlers';
import { Endpoints } from './endpoints';

const sendError = (res: any, error: any) => {
  console.error(error);
  res.status(error.statusCode ?? 500).send({ error: error.message ?? 'Internal server error' });
};

router.get(Endpoints.GetGameWorld, async (req: any, res: any) => {
  await handlers.getGameWorld(Number(req.params.gwId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.delete(Endpoints.DeleteGameWorld, async (req: any, res: any) => {
  await handlers.deleteGameWorld(Number(req.params.gwId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetGameWorlds, async (req: any, res: any) => {
  await handlers.getGameWorlds()
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetLeagueStandings, async (req: any, res: any) => {
  await handlers.getLeagueStandings(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetLeagueToday, async (req: any, res: any) => {
  // @spec TODAY-001,TODAY-002,TODAY-003,TODAY-004,TODAY-005,TODAY-006,TODAY-007
  await handlers.getLeagueToday(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetLeagueBracket, async (req: any, res: any) => {
  await handlers.getLeagueBracket(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetLeague, async (req: any, res: any) => {
  await handlers.getLeague(Number(req.params.leagueId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.NewGameWorld, async (req: any, res: any) => {
  console.debug(req.body);
  await handlers.newGameWorld({
    name: req.body.name,
    leagues: req.body.leagues,
    teams: req.body.teams,
    year: req.body.year
  }).then((response) => {
    res.send(response);
  }).catch((error) => sendError(res, error));
});

router.post(Endpoints.SetManagedClub, async (req: any, res: any) => {
  // @spec MCLB-003,MCLB-004,MCLB-005
  await handlers.setManagedClub(Number(req.params.gwId), req.body?.teamId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.SignPlayer, async (req: any, res: any) => {
  // @spec XFER-001,XFER-002,XFER-003,XFER-007,XFER-010,XFER-012,XFER-013,XFER-020
  await handlers.signPlayer(Number(req.params.teamId), req.body?.playerId, req.body?.endDate)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.ReleasePlayer, async (req: any, res: any) => {
  // @spec XFER-001,XFER-004,XFER-010,XFER-014,XFER-015,XFER-016,XFER-017
  await handlers.releasePlayer(Number(req.params.teamId), req.body?.playerId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.RenewPlayer, async (req: any, res: any) => {
  // @spec XFER-001,XFER-005,XFER-006,XFER-007,XFER-010,XFER-018,XFER-019,XFER-020
  await handlers.renewPlayer(Number(req.params.teamId), req.body?.playerId, req.body?.endDate)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetFreeAgents, async (req: any, res: any) => {
  // @spec XFER-009,XFER-023
  await handlers.getFreeAgents(Number(req.params.gwId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.LeagueSeasonCutover, async (req: any, res: any) => {
  // @spec SCL-015
  await handlers.cutoverLeagueSeason(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.LeagueSeasonStart, async (req: any, res: any) => {
  // @spec SCL-016
  await handlers.startLeagueSeason(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.patch(Endpoints.UpdateDivisionSchedulingConfig, async (req: any, res: any) => {
  // @spec SCL-017
  await handlers.updateDivisionSchedulingConfig(Number(req.params.divisionId), req.body.schedulingConfig)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetTeamSchedule, async (req: any, res: any) => {
  const teamId = Number(req.params.teamId);
  const gwId = Number(req.query.gwId);
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;

  await handlers.getTeamSchedule(teamId, gwId, leagueId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetTeamRoster, async (req: any, res: any) => {
  // @spec ROST-001,ROST-002,ROST-003,ROST-005,ROST-007,ROST-008,ROST-009,ROST-010
  const gwId = req.query.gwId == null ? undefined : Number(req.query.gwId);
  await handlers.getTeamRoster(Number(req.params.teamId), gwId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetTeamLineup, async (req: any, res: any) => {
  // @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004,LSNAP-004
  const gwId = req.query.gwId == null ? undefined : Number(req.query.gwId);
  const gameId = req.query.gameId == null ? undefined : Number(req.query.gameId);
  await handlers.getTeamLineup(Number(req.params.teamId), gwId, gameId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.patch(Endpoints.UpdateTeamLineup, async (req: any, res: any) => {
  // @spec LWRITE-001,LWRITE-002
  await handlers.updateTeamLineup(Number(req.params.teamId), req.body?.entries)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetPlayerDetail, async (req: any, res: any) => {
  // @spec PDET-001,PDET-002,PDET-003,PDET-004,PDET-007,PDET-008,PDET-010,PDET-011
  const gwId = req.query.gwId == null ? undefined : Number(req.query.gwId);
  await handlers.getPlayerDetail(Number(req.params.playerId), gwId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.BatchSimulateGames, async (req: any, res: any) => {
  await handlers.simulateBatchGames(Number(req.params.gwId), req.body?.endDate)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.RapidSimulateSeason, async (req: any, res: any) => {
  // @spec RSS-007 route wiring for the dev-only rapid-simulate endpoint.
  await handlers.rapidSimulateSeason(Number(req.params.gwId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.SimulateGame, async (req: any, res: any) => {
  await handlers.simulateGame(Number(req.params.gameId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

export { router };
