const express = require('express');
const router = express.Router();
import db from '../db/client';
import * as handlers from './handlers';
import { Endpoints } from './endpoints';

db.sync();

router.get(Endpoints.GetGameWorld, async (req: any, res: any) => {
  await handlers.getGameWorld(Number(req.params.gwId))
    .then((response) => {
      res.send(response);
    })
    .catch ((error) => {
      console.error(error);
      res.send(error);
    });
});

router.get(Endpoints.GetGameWorlds, async (req: any, res: any) => {
  await handlers.getGameWorlds()
    .then((response) => {
      res.send(response);
    })
    .catch ((error) => {
      console.error(error);
      res.send(error);
    });
});

router.get(Endpoints.GetLeagueStandings, async (req: any, res: any) => {
  await handlers.getLeagueStandings(Number(req.params.leagueId))
    .then((response) => res.send(response))
    .catch((error) => { console.error(error); res.send(error); });
});

router.get(Endpoints.GetLeague, async (req: any, res: any) => {
  await handlers.getLeague(Number(req.params.leagueId))
    .then((response) => {
      res.send(response);
    })
    .catch((error) => {
      console.error(error);
      res.send(error);
    });
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
  }).catch((error) => {
    console.error(error);
    res.send(error);
  });
});

router.post(Endpoints.NewSeason, async (req: any, res: any) => {
  console.debug(req.body);
  await handlers.newSeason(req.params.gwId)
    .then((response) => {
      res.send(response);
    })
    .catch((error) => {
      console.error(error);
      res.send(error);
    });
});

router.get(Endpoints.GetTeamSchedule, async (req: any, res: any) => {
  const teamId = Number(req.params.teamId);
  const gwId = Number(req.query.gwId);
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;

  await handlers.getTeamSchedule(teamId, gwId, leagueId)
    .then((response) => res.send(response))
    .catch((error) => { console.error(error); res.send(error); });
});

router.post(Endpoints.SimulateGame, async (req: any, res: any) => {
  console.debug(`Simulate Game ${req.params.id}: ${req.body}`);
  await handlers.simulateGame(req.params.gwId)
    .then((response) => {
      console.debug(response);
      res.send(response);
    })
    .catch((error) => {
      console.error(error);
      res.send(error);
    });
});

export { router };