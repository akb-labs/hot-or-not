'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

const MIN_C = -25;
const MAX_C = 50;

let currentCelsius = null;
let lastCelsius = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const screenQuestion = document.getElementById('screen-question');
const screenResult   = document.getElementById('screen-result');
const celsiusValue   = document.getElementById('celsius-value');
const answerForm     = document.getElementById('answer-form');
const userAnswerInput = document.getElementById('user-answer');
const inputError     = document.getElementById('input-error');
const resultBadge    = document.getElementById('result-badge');
const resultIcon     = document.getElementById('result-icon');
const resultText     = document.getElementById('result-text');
const resultEquation = document.getElementById('result-equation');
const resultDiff     = document.getElementById('result-diff');
const resultFormula  = document.getElementById('result-formula');
const resultContext  = document.getElementById('result-context');
const contextText    = document.getElementById('context-text');
const nextBtn        = document.getElementById('next-btn');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomCelsius() {
  let value;
  do {
    value = Math.floor(Math.random() * (MAX_C - MIN_C + 1)) + MIN_C;
  } while (value === lastCelsius);
  return value;
}

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function clearError() {
  inputError.textContent = '';
}

// ─── New question ─────────────────────────────────────────────────────────────

function newQuestion() {
  currentCelsius = randomCelsius();
  lastCelsius = currentCelsius;

  celsiusValue.textContent = currentCelsius;
  userAnswerInput.value = '';
  clearError();

  // Re-enable submit button in case it was disabled from the previous round
  answerForm.querySelector('button[type="submit"]').disabled = false;

  showScreen(screenQuestion);

  // Small delay so the transition doesn't fight focus
  requestAnimationFrame(() => userAnswerInput.focus());
}

// ─── Submit answer ────────────────────────────────────────────────────────────

answerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const raw = userAnswerInput.value.trim();

  if (raw === '' || !/^-?\d+$/.test(raw)) {
    inputError.textContent = 'Please enter a whole number.';
    userAnswerInput.focus();
    return;
  }

  const userAnswer = parseInt(raw, 10);
  const celsius = currentCelsius;

  // Optimistic disable while request is in flight
  const submitBtn = answerForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ celsius, userAnswer }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      inputError.textContent = body.error || 'Something went wrong. Try again.';
      submitBtn.disabled = false;
      userAnswerInput.focus();
      return;
    }

    const data = await res.json();
    showResult({ celsius, userAnswer, ...data });

  } catch (err) {
    inputError.textContent = 'Network error. Check your connection.';
    submitBtn.disabled = false;
    userAnswerInput.focus();
  }
});

// ─── Show result ──────────────────────────────────────────────────────────────

function showResult({ celsius, userAnswer, correct, exactAnswer, rawAnswer, diff, context }) {
  // Badge
  resultBadge.className = 'result-badge ' + (correct ? 'correct' : 'wrong');
  resultIcon.textContent = correct ? '✓' : '✗';
  resultText.textContent = correct ? 'Correct!' : 'Not quite';

  // Equation
  resultEquation.textContent = `${celsius}°C = ${exactAnswer}°F`;

  // Diff (only if wrong)
  if (!correct) {
    const absDiff = Math.abs(diff);
    const direction = diff > 0 ? 'high' : 'low';
    resultDiff.textContent = `You said ${userAnswer}°F — off by ${absDiff}° (${direction})`;
    resultDiff.classList.remove('hidden');
  } else {
    resultDiff.textContent = '';
    resultDiff.classList.add('hidden');
  }

  // Formula breakdown
  const rawRounded = (celsius * 9 / 5 + 32).toFixed(1);
  resultFormula.textContent = `${celsius} × 9/5 + 32 = ${rawRounded} → ${exactAnswer}°F`;

  // Context
  if (context) {
    contextText.textContent = context;
    resultContext.classList.remove('hidden');
  } else {
    resultContext.classList.add('hidden');
  }

  showScreen(screenResult);
  nextBtn.focus();
}

// ─── Next question ────────────────────────────────────────────────────────────

nextBtn.addEventListener('click', () => {
  newQuestion();
});

// ─── View count ───────────────────────────────────────────────────────────────

async function loadViewCount() {
  try {
    const res = await fetch('/api/stats/summary');
    if (!res.ok) return;
    const { totalAttempts } = await res.json();
    const text = `${totalAttempts.toLocaleString()} temps translated`;
    document.getElementById('view-count').textContent = text;
    document.getElementById('view-count-result').textContent = text;
  } catch (_) {}
}

// ─── Init ─────────────────────────────────────────────────────────────────────

newQuestion();
loadViewCount();
