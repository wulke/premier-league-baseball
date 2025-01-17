const fs = require('fs');
require('dotenv').config();
const testDbPath = process.env.DATABASE_URL;

export default async () => {
  fs.unlink(testDbPath, (err) => {
    if (err) throw err;
  });
};