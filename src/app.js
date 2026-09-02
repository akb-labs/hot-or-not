'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { getContext } = require('./temps');

// Simple bot filter — don't count obvious crawlers
function isBot(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  return /bot|crawl|spider|slurp|facebookexternalhit|curl|wget|python|java|go-http|headless/i.test(ua);
}

// ─── Cookie helpers (no dependency — just enough to read/set one cookie) ──────

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

const VISITOR_COOKIE = 'visitor_id';
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // ~5 years

const app = express();

// Trust Vercel's edge proxy so req.secure reflects the real (https) protocol.
app.set('trust proxy', true);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());

// Give every visitor a private, anonymous ID (no login) so quiz history and
// stats are scoped to them instead of shared globally.
app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  let visitorId = cookies[VISITOR_COOKIE];
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    const secure = req.secure ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${VISITOR_COOKIE}=${visitorId}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
  }
  req.visitorId = visitorId;
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Pages ────────────────────────────────────────────────────────────────────

app.get('/', async (req, res) => {
  if (!isBot(req)) db.trackView().catch(() => {});
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/stats', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/stats.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/about.html'));
});

app.get('/api/views', async (req, res) => {
  try {
    const total = await db.getViewCount();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch view count' });
  }
});

// ─── API: Submit answer ───────────────────────────────────────────────────────

app.post('/api/answer', async (req, res) => {
  const { celsius, userAnswer } = req.body;

  if (
    celsius === undefined ||
    userAnswer === undefined ||
    !Number.isInteger(celsius) ||
    !Number.isInteger(userAnswer) ||
    celsius < -25 ||
    celsius > 50
  ) {
    return res.status(400).json({ error: 'Invalid answer' });
  }

  const exactAnswer = Math.round(celsius * 9 / 5 + 32);
  const rawAnswer = celsius * 9 / 5 + 32;
  const diff = userAnswer - exactAnswer;
  const correct = Math.abs(diff) <= 1;
  const context = getContext(celsius);

  try {
    await db.saveAttempt({ celsius, userAnswer, exactAnswer, correct, visitorId: req.visitorId });
    res.json({ correct, exactAnswer, rawAnswer, diff, context });
  } catch (err) {
    console.error('DB write error:', err);
    res.status(500).json({ error: 'Failed to save attempt' });
  }
});

// ─── API: Stats (scoped to the current visitor) ──────────────────────────────

app.get('/api/stats/weekly', async (req, res) => {
  try {
    const data = await db.getWeeklyStats(req.visitorId);
    res.json(data);
  } catch (err) {
    console.error('Weekly stats error:', err);
    res.status(500).json({ error: 'Failed to fetch weekly stats' });
  }
});

app.get('/api/stats/breakdown', async (req, res) => {
  try {
    const data = await db.getBreakdown(req.visitorId);
    res.json(data);
  } catch (err) {
    console.error('Breakdown error:', err);
    res.status(500).json({ error: 'Failed to fetch breakdown' });
  }
});

app.get('/api/stats/summary', async (req, res) => {
  try {
    const data = await db.getSummary(req.visitorId);
    res.json(data);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>404</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:4rem;">
      <h1>404 — Page not found</h1>
      <p><a href="/">Back to quiz</a></p>
    </body>
    </html>
  `);
});

module.exports = app;
