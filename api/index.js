'use strict';

require('dotenv').config();

const app = require('../src/app');
const db = require('../src/db');

// Vercel serverless entry point. Each cold-started lambda instance needs the
// schema to exist before handling requests; init() is idempotent (CREATE
// TABLE IF NOT EXISTS) so it's safe to run once per warm instance.
let initPromise = null;
function ensureInit() {
  if (!initPromise) {
    initPromise = db.init().catch((err) => {
      initPromise = null; // let the next request retry instead of caching a failure forever
      throw err;
    });
  }
  return initPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureInit();
  } catch (err) {
    console.error('DB init failed:', err);
  }
  return app(req, res);
};
