export class GameSimulationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 422
  ) {
    super(message);
    this.name = 'GameSimulationError';
  }
}
