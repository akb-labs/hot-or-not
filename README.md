# Celsius Quiz

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?logo=render&logoColor=white)

A personal web app for building intuitive Celsius-to-Fahrenheit temperature conversion — not by memorizing a formula, but by practicing until it clicks.

**[Live app →](https://your-app.onrender.com)** <!-- TODO: update after deploy -->

---

## The problem

I spend time with international students whose mental model for temperature is entirely in Celsius. The formula (°C × 9/5 + 32) is correct but too slow to be useful mid-conversation. The goal isn't to calculate — it's to *know* that 25°C is a warm day, 37°C is your body temperature, 0°C means wear a coat.

The only way to build that feel is repetition with immediate feedback.

---

## Screenshots

<!-- TODO: add screenshots after deployment -->
<!-- Quiz page | Result screen (correct) | Result screen (wrong) | Stats page -->

---

## How it works

1. A random Celsius temperature (-25 to 50) appears on screen, large and unambiguous
2. You type your Fahrenheit guess — no hints, no formula on screen
3. You submit; the app tells you if you're right (±1°F counts), shows the exact answer, and breaks down the math
4. If the temperature has a real-world meaning (like 37°C = body temp), it reveals it *after* your guess as a memory anchor
5. All attempts are saved to Postgres; `/stats` shows your accuracy by week and by temperature

---

## Architecture

```
Browser → Express (Node.js) → PostgreSQL
           │
           ├── GET /           → public/index.html
           ├── POST /api/answer → grade guess, save to DB, return result
           ├── GET /stats       → public/stats.html
           ├── GET /api/stats/weekly    → weekly accuracy for Chart.js
           └── GET /api/stats/breakdown → per-temperature table
```

No build step. No frontend framework. Vanilla HTML + CSS + JS on the frontend; Chart.js loaded from CDN.

---

## Local development

```bash
git clone https://github.com/your-username/celsius-quiz
cd celsius-quiz
npm install
cp .env.example .env
# Edit .env and set DATABASE_URL to your local Postgres connection string
node src/index.js
# Visit http://localhost:3000
```

The app creates the `attempts` table automatically on first start — no migration step needed.

---

## Tech stack

| Layer     | Technology               |
|-----------|--------------------------|
| Runtime   | Node.js + Express        |
| Database  | PostgreSQL via `pg`      |
| Frontend  | Vanilla HTML + CSS + JS  |
| Charts    | Chart.js (CDN)           |
| Hosting   | Render (free tier)       |

---

## Future ideas

- **SMS reminders** — a daily text with "what's 22°C in °F?" to build a habit without opening a browser
- **Spaced repetition** — weight question selection toward temperatures the user gets wrong most often
- **Multiple users** — add auth so others can track their own progress
- **Fahrenheit → Celsius direction** — reverse the quiz for completeness
- **Streak tracking** — streak of consecutive correct answers as light gamification

---

*Built to solve a real problem. The formula is C × 9/5 + 32. The goal is to not need it.*
