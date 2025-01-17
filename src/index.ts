require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.SERVER_PORT;
const HOST = process.env.SERVER_HOST;
app.use(express.json());

import { router as ApiRouter } from './api/router';

// static site assets
app.use('/', express.static('dist/ui'));
// apis
app.use('/', ApiRouter);

app.listen(PORT, HOST);
console.log(`Premier League Baseball -- running on http://${HOST}:${PORT}`);