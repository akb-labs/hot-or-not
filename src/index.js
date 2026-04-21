'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./db');
const { getContext } = require('./temps');

// Simple bot filter — don't count obvious crawlers
function isBot(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  return /bot|crawl|spider|slurp|facebookexternalhit|curl|wget|python|java|go-http|headless/i.test(ua);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());
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
    await db.saveAttempt({ celsius, userAnswer, exactAnswer, correct });
    res.json({ correct, exactAnswer, rawAnswer, diff, context });
  } catch (err) {
    console.error('DB write error:', err);
    res.status(500).json({ error: 'Failed to save attempt' });
  }
});

// ─── API: Stats ───────────────────────────────────────────────────────────────

app.get('/api/stats/weekly', async (req, res) => {
  try {
    const data = await db.getWeeklyStats();
    res.json(data);
  } catch (err) {
    console.error('Weekly stats error:', err);
    res.status(500).json({ error: 'Failed to fetch weekly stats' });
  }
});

app.get('/api/stats/breakdown', async (req, res) => {
  try {
    const data = await db.getBreakdown();
    res.json(data);
  } catch (err) {
    console.error('Breakdown error:', err);
    res.status(500).json({ error: 'Failed to fetch breakdown' });
  }
});

app.get('/api/stats/summary', async (req, res) => {
  try {
    const data = await db.getSummary();
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

// ─── Start ────────────────────────────────────────────────────────────────────

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
