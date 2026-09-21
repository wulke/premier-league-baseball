const express = require('express');
const router = express.Router();
import * as handlers from './handlers';
import { Endpoints } from './endpoints';
import { NotificationFactory } from '../db/domain';

const sendError = (res: any, error: any) => {
  console.error(error);
  res.status(error.statusCode ?? 500).send({ error: error.message ?? 'Internal server error' });
};

router.get(Endpoints.GetGameWorld, async (req: any, res: any) => {
  // @spec MCLB-002,RSS-007
  await handlers.getGameWorld(Number(req.params.gwId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.delete(Endpoints.DeleteGameWorld, async (req: any, res: any) => {
  // @spec GWD-001,GWD-002,GWD-003,GWD-004
  await handlers.deleteGameWorld(Number(req.params.gwId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetGameWorlds, async (req: any, res: any) => {
  // @spec GWA-001,GWA-002
  await handlers.getGameWorlds()
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetLeagueStandings, async (req: any, res: any) => {
  // @spec LRD-003,LRD-004,LRD-005
  await handlers.getLeagueStandings(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});


router.get(Endpoints.GetLeagueBracket, async (req: any, res: any) => {
  // @spec API-001,API-002,API-003,API-004
  await handlers.getLeagueBracket(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetLeague, async (req: any, res: any) => {
  // @spec LRD-001,LRD-002
  await handlers.getLeague(Number(req.params.leagueId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.NewGameWorld, async (req: any, res: any) => {
  // @spec GWA-003,GWA-004,GWA-005
  // @spec TLO-002 — teams ride on each League config; no world-level pool field
  await handlers.newGameWorld({
    name: req.body.name,
    leagues: req.body.leagues,
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
  // @spec TSCH-001,TSCH-002,TSCH-003,TSCH-004,CALW-001,CALW-002,CALW-003,CALW-004,CALW-005,CALW-006,CALW-007,CALW-008,CALW-009
  const teamId = Number(req.params.teamId);
  const gwId = Number(req.query.gwId);
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;
  // CALW-007: a lone from/to is treated as no range — only build one when both are present.
  const range = (req.query.from && req.query.to)
    ? { from: String(req.query.from), to: String(req.query.to) }
    : undefined;

  await handlers.getTeamSchedule(teamId, gwId, leagueId, range)
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
  // @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004,LREAD-005,LSNAP-004,PREGAME-002
  const gwId = req.query.gwId == null ? undefined : Number(req.query.gwId);
  const gameId = req.query.gameId == null ? undefined : Number(req.query.gameId);
  await handlers.getTeamLineup(Number(req.params.teamId), gwId, gameId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetNextTeamGameLineup, async (req: any, res: any) => {
  // @spec GBULL-001,GBULL-002
  const gwId = req.query.gwId == null ? undefined : Number(req.query.gwId);
  await handlers.getNextTeamGameLineup(Number(req.params.teamId), gwId)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.put(Endpoints.SaveTeamLineup, async (req: any, res: any) => {
  // @spec LEDIT-001,LEDIT-002,LEDIT-003,LEDIT-004
  await handlers.saveTeamLineup(Number(req.params.teamId), req.body?.entries)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.patch(Endpoints.SaveTeamGameLineup, async (req: any, res: any) => {
  // @spec GBULL-003,GBULL-004,GBULL-005
  await handlers.saveTeamGameLineup(Number(req.params.teamId), Number(req.params.gameId), req.body?.entries)
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

router.get(Endpoints.GetPlayerStats, async (req: any, res: any) => {
  // @spec PSTATQ-001,PSTATQ-002,PSTATQ-003
  await handlers.getPlayerStats(Number(req.params.playerId), req.query.grain, req.query.gwId == null ? undefined : Number(req.query.gwId))
    .then((response) => res.send(response)).catch((error) => sendError(res, error));
});

router.get(Endpoints.GetGameBoxScore, async (req: any, res: any) => {
  // @spec BOXS-001,BOXS-002,BOXS-003,BOXS-004,BOXS-005
  await handlers.getGameBoxScore(Number(req.params.gameId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.GetGameWorldNotifications, async (req: any, res: any) => {
  // @spec NOTIF-003,NOTIF-006,NOTIF-007
  const since = req.query.since == null ? undefined : Number(req.query.since);
  await handlers.getGameWorldNotifications(Number(req.params.gwId), since)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.get(Endpoints.StreamGameWorldNotifications, (req: any, res: any) => {
  // @spec NOTIF-008,NOTIF-009 — bypasses the standard handlers.*().then(res.send)
  // pattern: an SSE connection writes over time rather than resolving a single
  // response body, so it's wired directly against NotificationFactory here.
  const gwId = Number(req.params.gwId);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  NotificationFactory().subscribe(gwId, res);
  req.on('close', () => NotificationFactory().unsubscribe(gwId, res));
});

router.post(Endpoints.BatchSimulateGames, async (req: any, res: any) => {
  // @spec SIM-008,SIM-009,SIM-010,SIM-011,SIM-012,SIM-013,SIM-014,SIM-015,SIM-019,SIM-020
  await handlers.simulateBatchGames(Number(req.params.gwId), req.body?.endDate)
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.RapidSimulateSeason, async (req: any, res: any) => {
  // @spec RSS-001,RSS-002,RSS-003,RSS-004,RSS-005,RSS-006,RSS-007 — route wiring for the dev-only rapid-simulate endpoint.
  await handlers.rapidSimulateSeason(Number(req.params.gwId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});

router.post(Endpoints.SimulateGame, async (req: any, res: any) => {
  // @spec SIM-001,SIM-002,SIM-003,SIM-004,SIM-005,SIM-006,SIM-007
  await handlers.simulateGame(Number(req.params.gameId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => sendError(res, error));
});

export { router };
