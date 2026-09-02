'use strict';

const { Pool } = require('pg');

// External Render URLs require SSL; disable cert verification for self-signed certs
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Schema init ──────────────────────────────────────────────────────────────

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS attempts (
        id           SERIAL PRIMARY KEY,
        celsius      INTEGER     NOT NULL,
        user_answer  INTEGER     NOT NULL,
        exact_answer INTEGER     NOT NULL,
        correct      BOOLEAN     NOT NULL,
        visitor_id   TEXT,
        answered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- In case this table was created before visitor_id existed.
      ALTER TABLE attempts ADD COLUMN IF NOT EXISTS visitor_id TEXT;

      CREATE INDEX IF NOT EXISTS idx_answered_at ON attempts (answered_at);
      CREATE INDEX IF NOT EXISTS idx_celsius      ON attempts (celsius);
      CREATE INDEX IF NOT EXISTS idx_visitor_id   ON attempts (visitor_id);

      CREATE TABLE IF NOT EXISTS page_views (
        id         SERIAL PRIMARY KEY,
        viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Database ready');
  } finally {
    client.release();
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Save one quiz attempt, tagged with the anonymous visitor who made it.
 */
async function saveAttempt({ celsius, userAnswer, exactAnswer, correct, visitorId }) {
  await pool.query(
    `INSERT INTO attempts (celsius, user_answer, exact_answer, correct, visitor_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [celsius, userAnswer, exactAnswer, correct, visitorId],
  );
}

/**
 * Weekly accuracy for one visitor — one row per calendar week that has at
 * least one attempt. week_start is truncated to Monday (ISO week).
 */
async function getWeeklyStats(visitorId) {
  const { rows } = await pool.query(
    `
    SELECT
      date_trunc('week', answered_at)::date  AS week_start,
      COUNT(*)::int                          AS attempts,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int AS correct
    FROM attempts
    WHERE visitor_id = $1
    GROUP BY week_start
    ORDER BY week_start ASC
  `,
    [visitorId],
  );
  return rows;
}

/**
 * Per-temperature breakdown for one visitor — one row per celsius value they've
 * attempted at least once, sorted by accuracy ascending (worst first).
 */
async function getBreakdown(visitorId) {
  const { rows } = await pool.query(
    `
    SELECT
      celsius,
      MAX(exact_answer)                                        AS exact_answer,
      COUNT(*)::int                                            AS attempts,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int           AS correct,
      ROUND(
        100.0 * SUM(CASE WHEN correct THEN 1 ELSE 0 END) / COUNT(*),
        1
      )                                                        AS accuracy
    FROM attempts
    WHERE visitor_id = $1
    GROUP BY celsius
    ORDER BY accuracy ASC, celsius ASC
  `,
    [visitorId],
  );
  return rows;
}

/**
 * Overall summary stats for one visitor, for the stats page header and the
 * homepage counter.
 */
async function getSummary(visitorId) {
  const { rows } = await pool.query(
    `
    SELECT
      COUNT(*)::int                                            AS "totalAttempts",
      SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int           AS "totalCorrect",
      MIN(answered_at)                                         AS "firstAnsweredAt"
    FROM attempts
    WHERE visitor_id = $1
  `,
    [visitorId],
  );
  return rows[0];
}

async function trackView() {
  await pool.query(`INSERT INTO page_views DEFAULT VALUES`);
}

async function getViewCount() {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM page_views`);
  return rows[0].total;
}

module.exports = { init, saveAttempt, getWeeklyStats, getBreakdown, getSummary, trackView, getViewCount };
