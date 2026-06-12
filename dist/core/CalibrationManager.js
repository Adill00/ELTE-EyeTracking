const CALIBRATION_VERSION = 1;
const CLICKS_PER_POINT = 5;
const FIXATION_DELAY_MS = 450; // wait after dot appears before accepting clicks
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
`;
function getGridPositions() {
    const margin = 0.1;
    const positions = [];
    for (const ry of [margin, 0.5, 1 - margin]) {
        for (const rx of [margin, 0.5, 1 - margin]) {
            positions.push({ x: rx, y: ry });
        }
    }
    return positions;
}
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export class CalibrationManager {
    constructor() {
        this.styleEl = null;
    }
    ensureStyles() {
        if (this.styleEl)
            return;
        this.styleEl = document.createElement('style');
        this.styleEl.textContent = DEFAULT_STYLES;
        document.head.appendChild(this.styleEl);
    }
    async run(engine) {
        this.ensureStyles();
        const points = getGridPositions();
        const recorded = [];
        const overlay = document.createElement('div');
        overlay.className = 'eye-tracking-calibration-overlay';
        const label = document.createElement('div');
        label.className = 'eye-tracking-calibration-label';
        const dots = points.map(pos => {
            const dot = document.createElement('div');
            dot.className = 'eye-tracking-calibration-point';
            dot.style.left = `${pos.x * 100}vw`;
            dot.style.top = `${pos.y * 100}vh`;
            overlay.appendChild(dot);
            return dot;
        });
        overlay.appendChild(label);
        document.body.appendChild(overlay);
        for (let i = 0; i < points.length; i++) {
            const dot = dots[i];
            const pos = points[i];
            const px = pos.x * window.innerWidth;
            const py = pos.y * window.innerHeight;
            // Show dot and give the user time to move their gaze to it
            dot.classList.add('is-active');
            label.textContent = `Point ${i + 1} of ${points.length} — look at the dot…`;
            await wait(FIXATION_DELAY_MS);
            // Now accept clicks
            await new Promise(resolve => {
                let clicks = 0;
                label.textContent = `Point ${i + 1} of ${points.length} — click ${CLICKS_PER_POINT} times`;
                const handler = () => {
                    engine.train(px, py);
                    recorded.push({ x: px, y: py });
                    clicks++;
                    // Flash the dot so the user sees the click was registered
                    dot.classList.add('is-registered');
                    setTimeout(() => dot.classList.remove('is-registered'), 260);
                    const remaining = CLICKS_PER_POINT - clicks;
                    if (remaining > 0) {
                        label.textContent = `Point ${i + 1} of ${points.length} — ${remaining} more click${remaining === 1 ? '' : 's'}`;
                    }
                    else {
                        label.textContent = `Point ${i + 1} of ${points.length} — done ✓`;
                        dot.removeEventListener('click', handler);
                        setTimeout(resolve, 220);
                    }
                };
                dot.addEventListener('click', handler);
            });
            dot.classList.remove('is-active', 'is-registered');
            await wait(80); // brief gap before next dot appears
        }
        overlay.remove();
        return {
            version: CALIBRATION_VERSION,
            points: recorded,
            timestamp: Date.now(),
        };
    }
}
//# sourceMappingURL=CalibrationManager.js.map