'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const valTotal    = document.getElementById('val-total');
const valAccuracy = document.getElementById('val-accuracy');
const valSince    = document.getElementById('val-since');
const chartCanvas = document.getElementById('weekly-chart');
const chartEmpty  = document.getElementById('chart-empty');
const tableEmpty  = document.getElementById('table-empty');
const breakdownTable = document.getElementById('breakdown-table');
const breakdownBody  = document.getElementById('breakdown-body');
const statsError  = document.getElementById('stats-error');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(numerator, denominator) {
  if (!denominator) return '—';
  return Math.round((numerator / denominator) * 100) + '%';
}

/**
 * Format a week-start ISO date string (e.g. "2025-03-31") into "Mar 31 – Apr 6"
 */
function fmtWeekLabel(isoDate) {
  // isoDate may be a full ISO string ("2026-04-13T00:00:00.000Z") or "YYYY-MM-DD"
  // Always extract just the date portion before parsing to avoid Invalid Date
  const dateStr = isoDate instanceof Date
    ? isoDate.toISOString().slice(0, 10)
    : String(isoDate).slice(0, 10);

  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(year, month - 1, day); // local time — no UTC shift
  const end   = new Date(start);
  end.setDate(end.getDate() + 6);

  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function fmtDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function accuracyColor(pct) {
  if (pct < 50)  return 'var(--color-wrong)';
  if (pct < 80)  return 'var(--color-amber)';
  return 'var(--color-correct)';
}

function accuracyClass(pct) {
  if (pct < 50)  return 'acc-red';
  if (pct < 80)  return 'acc-amber';
  return 'acc-green';
}

// ─── Summary ──────────────────────────────────────────────────────────────────

async function loadSummary() {
  const res = await fetch('/api/stats/summary');
  if (!res.ok) throw new Error('summary fetch failed');
  const { totalAttempts, totalCorrect, firstAnsweredAt } = await res.json();

  valTotal.textContent    = totalAttempts.toLocaleString();
  valAccuracy.textContent = fmtPct(totalCorrect, totalAttempts);
  valSince.textContent    = fmtDate(firstAnsweredAt);
}

// ─── Weekly chart ─────────────────────────────────────────────────────────────

async function loadWeeklyChart() {
  const res = await fetch('/api/stats/weekly');
  if (!res.ok) throw new Error('weekly fetch failed');
  const rows = await res.json();

  if (!rows.length) {
    chartEmpty.classList.remove('hidden');
    chartCanvas.classList.add('hidden');
    return;
  }

  const labels  = rows.map(r => fmtWeekLabel(r.week_start));
  const data    = rows.map(r => Math.round((r.correct / r.attempts) * 100));
  const counts  = rows.map(r => r.attempts);

  new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Accuracy %',
        data,
        backgroundColor: 'rgba(20, 184, 166, 0.75)',
        borderColor: 'rgba(20, 184, 166, 1)',
        borderWidth: 1.5,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: v => v + '%',
            font: { family: 'DM Sans', size: 12 },
            color: 'var(--color-muted)',
          },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        x: {
          ticks: {
            font: { family: 'DM Sans', size: 11 },
            color: 'var(--color-muted)',
            maxRotation: 35,
          },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              return ` ${data[idx]}%  (${counts[idx]} attempt${counts[idx] !== 1 ? 's' : ''})`;
            },
          },
          bodyFont: { family: 'DM Sans' },
          titleFont: { family: 'DM Sans' },
        },
      },
    },
  });
}

// ─── Breakdown table ──────────────────────────────────────────────────────────

async function loadBreakdown() {
  const res = await fetch('/api/stats/breakdown');
  if (!res.ok) throw new Error('breakdown fetch failed');
  const rows = await res.json();

  if (!rows.length) {
    tableEmpty.classList.remove('hidden');
    breakdownTable.classList.add('hidden');
    return;
  }

  breakdownTable.classList.remove('hidden');
  breakdownBody.innerHTML = '';

  rows.forEach((row, i) => {
    const pct = Math.round(row.accuracy);
    const tr = document.createElement('tr');
    tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';
    tr.innerHTML = `
      <td class="td-celsius">${row.celsius}°C</td>
      <td>${row.exact_answer}°F</td>
      <td>${row.attempts}</td>
      <td>${row.correct}</td>
      <td class="td-accuracy ${accuracyClass(pct)}">${pct}%</td>
    `;
    breakdownBody.appendChild(tr);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    await Promise.all([loadSummary(), loadWeeklyChart(), loadBreakdown()]);
  } catch (err) {
    console.error('Stats load error:', err);
    statsError.classList.remove('hidden');
  }
}

init();
