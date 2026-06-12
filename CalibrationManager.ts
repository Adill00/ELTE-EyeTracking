import type { GazeEngine } from '../engines/GazeEngine.js';
import type { CalibrationData, CalibrationPoint } from '../types.js';

const CALIBRATION_VERSION = 1;
const CLICKS_PER_POINT    = 5;
const FIXATION_DELAY_MS   = 450; // wait after dot appears before accepting clicks

export class CalibrationCancelledError extends Error {
  constructor() {
    super('Calibration was cancelled by the user.');
    this.name = 'CalibrationCancelledError';
  }
}

const DEFAULT_STYLES = `
.eye-tracking-calibration-overlay {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at center,
    rgba(0, 0, 0, 0.88) 35%,
    rgba(255, 248, 220, 0.94) 100%
  );
  z-index: 2147483646;
  cursor: crosshair;
}
.eye-tracking-calibration-point {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  border: 3px solid #4a90e2;
  transform: translate(-50%, -50%);
  cursor: pointer;
  display: none;
}
/* Pulsing state — only when NOT mid-click-flash */
.eye-tracking-calibration-point.is-active:not(.is-registered) {
  display: block;
  animation: eye-tracking-pulse 0.75s ease-in-out infinite alternate;
}
/* Click registration flash */
.eye-tracking-calibration-point.is-registered {
  display: block;
  animation: eye-tracking-register 0.24s ease-out forwards;
}
@keyframes eye-tracking-pulse {
  from { transform: translate(-50%, -50%) scale(1);   }
  to   { transform: translate(-50%, -50%) scale(1.55); }
}
@keyframes eye-tracking-register {
  0%   { transform: translate(-50%, -50%) scale(2.2); background: #4a90e2; border-color: #fff; }
  100% { transform: translate(-50%, -50%) scale(1);   background: #fff;    border-color: #4a90e2; }
}
.eye-tracking-calibration-label {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-family: sans-serif;
  font-size: 16px;
  font-weight: 500;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  z-index: 2147483647;
  white-space: nowrap;
}
.eye-tracking-calibration-exit {
  position: fixed;
  top: 20px;
  right: 24px;
  padding: 8px 18px;
  background: rgba(231, 76, 60, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  color: #fff;
  font-family: sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  z-index: 2147483647;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transition: opacity 0.15s, transform 0.1s;
}
.eye-tracking-calibration-exit:hover { opacity: 0.85; transform: translateY(-1px); }
.eye-tracking-calibration-exit:active { transform: translateY(0); }
`;

function getGridPositions(): Array<{ x: number; y: number }> {
  const margin = 0.1;
  const positions: Array<{ x: number; y: number }> = [];
  for (const ry of [margin, 0.5, 1 - margin]) {
    for (const rx of [margin, 0.5, 1 - margin]) {
      positions.push({ x: rx, y: ry });
    }
  }
  return positions;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new CalibrationCancelledError());
    }, { once: true });
  });
}

export class CalibrationManager {
  private styleEl: HTMLStyleElement | null = null;

  private ensureStyles(): void {
    if (this.styleEl) return;
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = DEFAULT_STYLES;
    document.head.appendChild(this.styleEl);
  }

  async run(engine: GazeEngine): Promise<CalibrationData> {
    this.ensureStyles();
    const points = getGridPositions();
    const recorded: CalibrationPoint[] = [];

    const controller = new AbortController();
    const { signal } = controller;

    const overlay = document.createElement('div');
    overlay.className = 'eye-tracking-calibration-overlay';

    const exitBtn = document.createElement('button');
    exitBtn.className = 'eye-tracking-calibration-exit';
    exitBtn.textContent = '✕ Exit Calibration';
    exitBtn.addEventListener('click', () => controller.abort(), { once: true });

    const label = document.createElement('div');
    label.className = 'eye-tracking-calibration-label';

    const dots = points.map(pos => {
      const dot = document.createElement('div');
      dot.className = 'eye-tracking-calibration-point';
      dot.style.left = `${pos.x * 100}vw`;
      dot.style.top  = `${pos.y * 100}vh`;
      overlay.appendChild(dot);
      return dot;
    });

    overlay.appendChild(exitBtn);
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    try {
      for (let i = 0; i < points.length; i++) {
        const dot = dots[i];
        const pos = points[i];
        const px  = pos.x * window.innerWidth;
        const py  = pos.y * window.innerHeight;

        dot.classList.add('is-active');
        label.textContent = `Point ${i + 1} of ${points.length} — look at the dot…`;
        await wait(FIXATION_DELAY_MS, signal);

        await new Promise<void>((resolve, reject) => {
          let clicks = 0;
          label.textContent = `Point ${i + 1} of ${points.length} — click ${CLICKS_PER_POINT} times`;

          signal.addEventListener('abort', () => reject(new CalibrationCancelledError()), { once: true });

          const handler = () => {
            engine.train(px, py);
            recorded.push({ x: px, y: py });
            clicks++;

            dot.classList.add('is-registered');
            setTimeout(() => dot.classList.remove('is-registered'), 260);

            const remaining = CLICKS_PER_POINT - clicks;
            if (remaining > 0) {
              label.textContent = `Point ${i + 1} of ${points.length} — ${remaining} more click${remaining === 1 ? '' : 's'}`;
            } else {
              label.textContent = `Point ${i + 1} of ${points.length} — done ✓`;
              dot.removeEventListener('click', handler);
              setTimeout(resolve, 220);
            }
          };

          dot.addEventListener('click', handler);
        });

        dot.classList.remove('is-active', 'is-registered');
        await wait(80, signal);
      }
    } finally {
      overlay.remove();
    }

    return {
      version: CALIBRATION_VERSION,
      points:  recorded,
      timestamp: Date.now(),
    };
  }
}
