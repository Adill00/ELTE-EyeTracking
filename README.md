# Eye Tracking Library

A browser-based JavaScript/TypeScript eye-tracking library that runs entirely on the client side. It uses the user's webcam and **MediaPipe FaceMesh** to estimate gaze position and maps it to specific HTML elements, tracking dwell time and firing events — all without any backend.

---

## Installation

**Requirements:** Node.js 18+ and npm.

```bash
# Clone / copy the project, then:
npm install
npm run build
```

---

## Running the Demo

Serve the project root (or `demo/`) over HTTP — **do not open `index.html` directly as `file://`**, as the browser will block camera and module access.

```bash
# Using any static server, e.g.:
npx serve .
# Then open: http://localhost:3000/demo/
```

The demo loads MediaPipe FaceMesh from `demo/vendor/mediapipe/face_mesh/` — no internet connection required.

---

## Quick Start

```js
import { EyeTracker } from './dist/index.js';

const tracker = new EyeTracker();

// 1. Calibrate (shows a 9-point overlay; model saved to localStorage)
await tracker.calibrate();

// 2. Observe specific elements (CSS selector or HTMLElement array)
await tracker.observe('.my-content-cards', 20); // 20px tolerance

// 3. React to gaze events
tracker.on('lookat',  ({ element }) => element.classList.add('highlighted'));
tracker.on('lookaway',({ element }) => element.classList.remove('highlighted'));

// 4. Stop observation and release camera
await tracker.stop();
```

> **Calibration persists:** after the first `calibrate()`, the regression model is saved to `localStorage`. Subsequent page loads can call `observe()` directly without re-calibrating.

---

## Public API

### Calibration

| Method | Signature | Description |
|---|---|---|
| `calibrate` | `() => Promise<CalibrationData>` | Shows a 9-point calibration overlay. Awaitable — resolves when the user completes all points. The gaze regression model is saved to `localStorage` so the page can skip recalibration on reload. |

### Observation

| Method | Signature | Description |
|---|---|---|
| `observe` | `(targets: HTMLElement[] \| string, tolerance?: number) => Promise<void>` | Starts gaze observation on the given elements or CSS selector. `tolerance` (default `0`) expands each element's hit-box by that many pixels on all sides. |
| `stop` | `() => Promise<void>` | Stops observation and fully releases the camera (MediaStream tracks are stopped). |
| `getCurrentElement` | `() => HTMLElement \| null` | Returns the element currently being fixated, or `null`. |

### Pointer

| Method | Signature | Description |
|---|---|---|
| `setPointerVisible` | `(visible: boolean) => void` | Shows or hides the on-screen gaze dot. |

### Statistics

| Method | Signature | Description |
|---|---|---|
| `loadStats` | `() => ElementStats[]` | Returns accumulated dwell-time data from `localStorage`. |
| `resetStats` | `() => void` | Clears all dwell-time counters and persists the empty state. |
| `setStatsEnabled` | `(enabled: boolean) => void` | Pauses or resumes dwell-time accumulation without losing existing data. |

### Events

Subscribe with `tracker.on(event, listener)` and unsubscribe with `tracker.off(event, listener)`.

| Event | Payload | Fired when |
|---|---|---|
| `lookat` | `{ element: HTMLElement }` | Gaze enters a tracked element. |
| `lookaway` | `{ element: HTMLElement }` | Gaze leaves a tracked element. |
| `currentElementChanged` | `{ element: HTMLElement \| null }` | The fixated element changes (including to `null` when gaze moves off all targets). |

---

## CSS Customization

All visual elements inject a default stylesheet but expose class names for overriding.

| Class | Element |
|---|---|
| `.eye-tracking-calibration-overlay` | Full-screen dark overlay shown during calibration. |
| `.eye-tracking-calibration-point` | Individual calibration dot. |
| `.eye-tracking-calibration-point.is-active` | The currently active calibration dot (pulsing). |
| `.eye-tracking-calibration-label` | Text instruction shown below the dots. |
| `.eye-tracking-pointer` | The real-time gaze position dot. |

**Example — custom pointer:**
```css
.eye-tracking-pointer {
  width: 12px;
  height: 12px;
  background: rgba(0, 200, 100, 0.7);
  border: none;
}
```

---

## TypeScript Types

```ts
interface CalibrationData {
  version: number;
  points: { x: number; y: number }[];
  timestamp: number;
}

interface ElementStats {
  elementId: string;   // value of data-eye-id attribute set on the element
  dwellMs: number;     // total milliseconds of fixation
}
```

---

## Third-Party Components

| Library | Version | License | Used for |
|---|---|---|---|
| [MediaPipe FaceMesh](https://github.com/google-ai-edge/mediapipe) | 0.4.x | Apache-2.0 | Iris landmark detection for gaze estimation |
| [TypeScript](https://www.typescriptlang.org/) | ^5.4 | Apache-2.0 | Compilation (dev only) |

No GPLv3 or copyleft dependencies are used. The library is safe to use in closed-source and commercial products.

See [LICENSES.md](./LICENSES.md) for full license texts.
