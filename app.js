import { EyeTracker, CalibrationCancelledError } from '../dist/index.js';

// ── DOM refs ──────────────────────────────────────────────────────────────
const btnCalibrate = document.getElementById('btn-calibrate');
const btnObserve   = document.getElementById('btn-observe');
const btnStop      = document.getElementById('btn-stop');
const btnPointer   = document.getElementById('btn-pointer');
const btnStats     = document.getElementById('btn-stats');
const btnReset     = document.getElementById('btn-reset');
const eventLog     = document.getElementById('event-log');
const statsBody    = document.getElementById('stats-body');
const canvas       = document.getElementById('detection-canvas');

// ── State ─────────────────────────────────────────────────────────────────
const tracker = new EyeTracker();
let pointerVisible = true;
let statsEnabled   = true;
let statsInterval  = null;

// Targets: all cards by CSS selector
const TARGET_SELECTOR = '.card, .overlap-wrapper, .overlap-front';

// ── Detection range canvas ────────────────────────────────────────────────
function drawDetectionRange() {
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth;
  const H = canvas.height = canvas.offsetHeight;

  ctx.clearRect(0, 0, W, H);

  // Outer glow
  const cx = W / 2, cy = H / 2;
  const rx = W * 0.42, ry = H * 0.38;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0,   'rgba(74, 144, 226, 0.12)');
  grad.addColorStop(0.7, 'rgba(74, 144, 226, 0.06)');
  grad.addColorStop(1,   'rgba(74, 144, 226, 0)');

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Border ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(74, 144, 226, 0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 9 calibration points
  const margin = 0.1;
  const positions = [];
  for (const ry2 of [margin, 0.5, 1 - margin]) {
    for (const rx2 of [margin, 0.5, 1 - margin]) {
      positions.push({ x: rx2 * W, y: ry2 * H });
    }
  }
  for (const p of positions) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(74, 144, 226, 0.7)';
    ctx.fill();
  }

  // Label
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#7f8c8d';
  ctx.textAlign = 'center';
  ctx.fillText('Confident gaze detection zone', cx, H - 12);
}

// ── Event log helpers ─────────────────────────────────────────────────────
function logEvent(type, text) {
  const li = document.createElement('li');
  li.className = type;
  li.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  if (eventLog.firstChild?.style?.color === 'rgb(170, 170, 170)') {
    eventLog.innerHTML = '';
  }
  eventLog.prepend(li);
  // Keep only last 20 entries
  while (eventLog.children.length > 20) {
    eventLog.removeChild(eventLog.lastChild);
  }
}

// ── Stats table ───────────────────────────────────────────────────────────
function refreshStats() {
  const items = tracker.loadStats();
  if (items.length === 0) {
    statsBody.innerHTML = '<tr><td colspan="2" style="color:#aaa">No data yet</td></tr>';
    return;
  }
  statsBody.innerHTML = items
    .sort((a, b) => b.dwellMs - a.dwellMs)
    .map(item => {
      const el = document.querySelector(`[data-eye-id="${item.elementId}"]`);
      const label = el?.dataset.label ?? item.elementId;
      const secs = (item.dwellMs / 1000).toFixed(1);
      return `<tr><td>${label}</td><td>${secs}s</td></tr>`;
    })
    .join('');
}

// ── Card gaze highlight ───────────────────────────────────────────────────
tracker.on('lookat', ({ element }) => {
  element.classList.add('is-gazed');
  logEvent('lookat', `lookat → ${element.dataset.label ?? element.id}`);
});

tracker.on('lookaway', ({ element }) => {
  element.classList.remove('is-gazed');
  logEvent('lookaway', `lookaway ← ${element.dataset.label ?? element.id}`);
});

tracker.on('currentElementChanged', ({ element }) => {
  const label = element ? (element.dataset.label ?? element.id) : 'none';
  logEvent('changed', `current → ${label}`);
});

// ── Button wiring ─────────────────────────────────────────────────────────
btnCalibrate.addEventListener('click', async () => {
  btnCalibrate.disabled = true;
  btnCalibrate.textContent = 'Calibrating…';
  let completed = false;
  try {
    await tracker.calibrate();
    completed = true;
    logEvent('changed', 'Calibration complete ✓');
    btnObserve.disabled = false;
  } catch (err) {
    if (err instanceof CalibrationCancelledError) {
      logEvent('lookaway', 'Calibration cancelled — camera released');
    } else {
      logEvent('lookaway', `Calibration failed: ${err.message}`);
    }
  } finally {
    btnCalibrate.disabled = false;
    btnCalibrate.textContent = completed ? 'Recalibrate' : 'Calibrate';
  }
});

btnObserve.addEventListener('click', async () => {
  btnObserve.disabled = true;
  btnObserve.textContent = 'Starting…';
  try {
    await tracker.observe(TARGET_SELECTOR, 20);
    statsInterval = setInterval(refreshStats, 1000);
    btnStop.disabled    = false;
    btnPointer.disabled = false;
    btnStats.disabled   = false;
    btnReset.disabled   = false;
    logEvent('changed', 'Observation started');
  } catch (err) {
    logEvent('lookaway', `Observation failed: ${err.message}`);
    btnObserve.disabled = false;
  } finally {
    btnObserve.textContent = 'Start Observation';
  }
});

btnStop.addEventListener('click', async () => {
  await tracker.stop();
  clearInterval(statsInterval);
  refreshStats();
  document.querySelectorAll('.card, .overlap-wrapper').forEach(el => el.classList.remove('is-gazed'));
  btnObserve.disabled = false;
  btnStop.disabled    = true;
  btnPointer.disabled = true;
  btnStats.disabled   = true;
  logEvent('changed', 'Observation stopped — camera released');
});

btnPointer.addEventListener('click', () => {
  pointerVisible = !pointerVisible;
  tracker.setPointerVisible(pointerVisible);
  btnPointer.textContent = pointerVisible ? 'Hide Pointer' : 'Show Pointer';
});

btnStats.addEventListener('click', () => {
  statsEnabled = !statsEnabled;
  tracker.setStatsEnabled(statsEnabled);
  btnStats.textContent = statsEnabled ? 'Disable Stats' : 'Enable Stats';
  logEvent('changed', `Stats collection ${statsEnabled ? 'enabled' : 'disabled'}`);
});

btnReset.addEventListener('click', () => {
  tracker.resetStats();
  refreshStats();
  logEvent('changed', 'Stats reset');
});

// ── Init ──────────────────────────────────────────────────────────────────
drawDetectionRange();
window.addEventListener('resize', drawDetectionRange);
