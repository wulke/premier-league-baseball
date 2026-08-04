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

router.get(Endpoints.GetTeamSchedule, async (req: any, res: any) => {
  const teamId = Number(req.params.teamId);
  const gwId = Number(req.query.gwId);
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;

  await handlers.getTeamSchedule(teamId, gwId, leagueId)
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
