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
        answered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_answered_at ON attempts (answered_at);
      CREATE INDEX IF NOT EXISTS idx_celsius      ON attempts (celsius);
    `);
    console.log('Database ready');
  } finally {
    client.release();
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Save one quiz attempt.
 */
async function saveAttempt({ celsius, userAnswer, exactAnswer, correct }) {
  await pool.query(
    `INSERT INTO attempts (celsius, user_answer, exact_answer, correct)
     VALUES ($1, $2, $3, $4)`,
    [celsius, userAnswer, exactAnswer, correct],
  );
}

/**
 * Weekly accuracy — one row per calendar week that has at least one attempt.
 * week_start is truncated to Monday (ISO week).
 */
async function getWeeklyStats() {
  const { rows } = await pool.query(`
    SELECT
      date_trunc('week', answered_at)::date  AS week_start,
      COUNT(*)::int                          AS attempts,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int AS correct
    FROM attempts
    GROUP BY week_start
    ORDER BY week_start ASC
  `);
  return rows;
}

/**
 * Per-temperature breakdown — one row per celsius value attempted at least once,
 * sorted by accuracy ascending (worst first).
 */
async function getBreakdown() {
  const { rows } = await pool.query(`
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
    GROUP BY celsius
    ORDER BY accuracy ASC, celsius ASC
  `);
  return rows;
}

/**
 * Overall summary stats for the stats page header.
 */
async function getSummary() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::int                                            AS "totalAttempts",
      SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int           AS "totalCorrect",
      MIN(answered_at)                                         AS "firstAnsweredAt"
    FROM attempts
  `);
  return rows[0];
}

module.exports = { init, saveAttempt, getWeeklyStats, getBreakdown, getSummary };
