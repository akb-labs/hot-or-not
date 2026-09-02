'use strict';

require('dotenv').config();

const app = require('./app');
const db = require('./db');

const PORT = process.env.PORT || 3000;

// Local/traditional-server entry point. Not used on Vercel — see api/index.js.
async function start() {
  try {
    await db.init();
    app.listen(PORT, () => {
      console.log(`Celsius Quiz running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
