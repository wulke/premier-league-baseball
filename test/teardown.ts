const fs = require('fs');
require('dotenv').config({ path: '.env.test' });
const testDbPath = process.env.DATABASE_URL;

export default async () => {
  fs.unlink(testDbPath, (err) => {
    if (err && err.code !== 'ENOENT') throw err;
  });
};
