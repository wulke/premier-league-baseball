const applyAssociations = (sequelize) => {
  const {
    Division,
    DivisionSeason,
    DivisionSeasonGame,
    Contract,
    Game,
    GameWorld,
    League,
    Player,
    PlayerGameStats,
    SeasonResult,
    Team
  } = sequelize.models;

  // GameWorld
  GameWorld.hasMany(League, { foreignKey: 'gameWorldId' });
  GameWorld.hasMany(Player, { foreignKey: 'gameWorldId' });
  GameWorld.hasMany(Team, { foreignKey: 'gameWorldId' });
  // League
  League.belongsTo(GameWorld, { foreignKey: 'gameWorldId' });
  League.hasMany(Division, { foreignKey: 'leagueId' });
  // Player
  Player.belongsTo(GameWorld, { foreignKey: 'gameWorldId' });
  Player.belongsTo(Team, { foreignKey: 'teamId' });
  // @spec PCON-009
  Player.hasMany(Contract, { foreignKey: 'playerId' });
  // @spec PSTAT-001,PSTAT-004
  Player.hasMany(PlayerGameStats, { foreignKey: 'playerId' });
  // @spec PCON-009
  Contract.belongsTo(Player, { foreignKey: 'playerId' });
  // @spec PCON-009
  Contract.belongsTo(Team, { foreignKey: 'teamId' });
  PlayerGameStats.belongsTo(Player, { foreignKey: 'playerId' });
  // Team
  Team.belongsTo(GameWorld, { foreignKey: 'gameWorldId' });
  Team.hasMany(Player, { foreignKey: 'teamId' });
  // @spec PCON-009
  Team.hasMany(Contract, { foreignKey: 'teamId' });
  Team.belongsToMany(Division, { foreignKey: 'teamId', through: 'DivisionSeason' });
  // Division
  Division.belongsTo(League, { foreignKey: 'leagueId' });
  Division.belongsToMany(Team, { foreignKey: 'divisionId', through: 'DivisionSeason' });
  // DivisionSeason
  DivisionSeason.belongsTo(Team, { foreignKey: 'teamId' });
  DivisionSeason.belongsTo(Division, { foreignKey: 'divisionId' });
  Team.hasMany(DivisionSeason, { foreignKey: 'teamId' });
  Division.hasMany(DivisionSeason, { foreignKey: 'divisionId' });
  // Game
  // @spec PSTAT-001,PSTAT-004
  Game.hasMany(PlayerGameStats, { foreignKey: 'gameId' });
  PlayerGameStats.belongsTo(Game, { foreignKey: 'gameId' });
  Game.belongsToMany(DivisionSeason, { foreignKey: 'gameId', through: DivisionSeasonGame });
  DivisionSeason.belongsToMany(Game, { foreignKey: 'divisionSeasonId', through: DivisionSeasonGame });
  DivisionSeasonGame.belongsTo(Game, { foreignKey: 'gameId' });
  DivisionSeasonGame.belongsTo(DivisionSeason, { foreignKey: 'divisionSeasonId' });
  Game.hasMany(DivisionSeasonGame, { foreignKey: 'gameId' });
  DivisionSeason.hasMany(DivisionSeasonGame, { foreignKey: 'divisionSeasonId' });
  // SeasonResult
  SeasonResult.belongsTo(Division, { foreignKey: 'divisionId' });
  SeasonResult.belongsTo(Team, { foreignKey: 'championTeamId' });
  Division.hasMany(SeasonResult, { foreignKey: 'divisionId' });
  Team.hasMany(SeasonResult, { foreignKey: 'championTeamId' });
};

export { applyAssociations };
