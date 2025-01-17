import client from '../src/db/client';

export default async () => await client.sync({ force: true });