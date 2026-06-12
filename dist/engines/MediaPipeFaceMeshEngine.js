// Iris landmark indices — available when refineLandmarks: true (478 total landmarks)
const IRIS_A = 468; // right iris centre (MediaPipe face-perspective)
const IRIS_B = 473; // left iris centre
// Eye-socket landmarks, used to express each iris as a fraction of its own eye
// opening — decoupled from face size and bounding-box jitter, so the feature
// tracks actual eyeball rotation rather than face-detection noise.
const RIGHT_EYE = { outer: 33, inner: 133, top: 159, bottom: 145 };
const LEFT_EYE = { inner: 362, outer: 263, top: 386, bottom: 374 };
// Tuning knobs
const BUFFER_SIZE = 24; // rolling frame buffer depth
const TRAIN_FRAMES = 12; // frames averaged per training click (noise reduction)
const EMA_ALPHA = 0.25; // exponential smoothing weight for live output
const RIDGE_LAMBDA = 1e-2; // regularisation for the polynomial fit (more terms → stronger)
const SCRIPT_SRC = './vendor/mediapipe/face_mesh/face_mesh.js';
const LOCATE_BASE = './vendor/mediapipe/face_mesh/';
const STORE_KEY = 'eye-tracking-regression-v2'; // v2: eye-local features + polynomial model
// ── Regression ─────────────────────────────────────────────────────
function gaussElim(A, b) {
    const n = A.length;
    const m = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++)
            if (Math.abs(m[r][c]) > Math.abs(m[p][c]))
                p = r;
        [m[c], m[p]] = [m[p], m[c]];
        for (let r = c + 1; r < n; r++) {
            const f = m[r][c] / m[c][c];
            for (let k = c; k <= n; k++)
                m[r][k] -= f * m[c][k];
        }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = m[i][n];
        for (let j = i + 1; j < n; j++)
            x[i] -= m[i][j] * x[j];
        x[i] /= m[i][i];
    }
    return x;
}
function ridgeFit(X, y, lam = 1e-3) {
    const F = X[0].length;
    const XtX = Array.from({ length: F }, (_, i) => Array.from({ length: F }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0) + (i === j ? lam : 0)));
    const Xty = Array.from({ length: F }, (_, i) => X.reduce((s, row, r) => s + row[i] * y[r], 0));
    return gaussElim(XtX, Xty);
}
function dot(a, b) {
    return a.reduce((s, v, i) => s + v * b[i], 0);
}
// Second-order polynomial expansion of the 4 eye-local features.
// The iris→screen mapping is curved (perspective + spherical eye rotation), so a
// linear fit can't represent it. Squares + cross terms let the same closed-form
// ridge solve bend to the screen. Returns the full design row (leading 1 = bias).
function polyFeatures(f) {
    const [a, b, c, d] = f; // ex_r, ey_r, ex_l, ey_l
    return [
        1,
        a, b, c, d,
        a * a, b * b, c * c, d * d,
        a * b, c * d, a * c,
    ];
}
// ── Engine ──────────────────────────────────────────────────────────
export class MediaPipeFaceMeshEngine {
    constructor() {
        this.gazeListener = null;
        this.running = false;
        this.fm = null;
        this.video = null;
        this.stream = null;
        this.loopActive = false;
        // Rolling buffer: recent face-normalised iris features, used to average clicks
        this.frameBuffer = [];
        // EMA state for smooth live output
        this.smoothX = null;
        this.smoothY = null;
        this.training = [];
        this.wx = [];
        this.wy = [];
        this.modelReady = false;
    }
    async start() {
        if (this.running)
            return;
        await this._loadScript();
        await this._initCamera();
        await this._initFaceMesh();
        this._restoreModel();
        this._runLoop();
        this.running = true;
    }
    async stop() {
        if (!this.running)
            return;
        this.loopActive = false;
        this.running = false;
        this.frameBuffer = [];
        this.smoothX = null;
        this.smoothY = null;
        if (this.fm) {
            try {
                await this.fm.close();
            }
            catch { /* ignore */ }
            this.fm = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.remove();
            this.video = null;
        }
    }
    setGazeListener(cb) { this.gazeListener = cb; }
    clearGazeListener() { this.gazeListener = null; }
    train(x, y) {
        const count = Math.min(this.frameBuffer.length, TRAIN_FRAMES);
        if (count === 0)
            return; // camera not ready yet
        // Average the most recent frames → one stable feature vector per click
        const F = this.frameBuffer[0].length;
        const avg = new Array(F).fill(0);
        const start = this.frameBuffer.length - count;
        for (let i = start; i < this.frameBuffer.length; i++) {
            for (let j = 0; j < F; j++)
                avg[j] += this.frameBuffer[i][j];
        }
        for (let j = 0; j < F; j++)
            avg[j] /= count;
        this.training.push({ features: avg, sx: x, sy: y });
        // 12 polynomial terms need samples from a few distinct points before the fit
        // is meaningful; ridge keeps it stable as more arrive and refine it.
        if (this.training.length >= 6)
            this._fit();
        this._persist();
    }
    clearTraining() {
        this.training = [];
        this.wx = [];
        this.wy = [];
        this.modelReady = false;
        this.smoothX = null;
        this.smoothY = null;
        localStorage.removeItem(STORE_KEY);
    }
    // ── private ──────────────────────────────────────────────────────
    _loadScript() {
        if (window.FaceMesh)
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = SCRIPT_SRC;
            s.onload = () => (window.FaceMesh ? resolve() : reject(new Error('FaceMesh missing after load')));
            s.onerror = () => reject(new Error(`Cannot load ${SCRIPT_SRC}`));
            document.head.appendChild(s);
        });
    }
    async _initCamera() {
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        const v = document.createElement('video');
        v.id = 'eye-tracking-video';
        v.srcObject = this.stream;
        v.muted = true;
        v.playsInline = true;
        // Off-screen: MediaPipe only needs the element playing, not visible
        Object.assign(v.style, {
            position: 'fixed', top: '-1px', left: '-1px',
            width: '1px', height: '1px', opacity: '0', pointerEvents: 'none',
        });
        document.body.appendChild(v);
        await v.play();
        this.video = v;
    }
    async _initFaceMesh() {
        const fm = new window.FaceMesh({ locateFile: f => `${LOCATE_BASE}${f}` });
        fm.setOptions({
            maxNumFaces: 1, refineLandmarks: true,
            minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
        });
        fm.onResults(r => {
            const lm = r.multiFaceLandmarks?.[0] ?? null;
            if (!lm)
                return;
            const f = this._features(lm);
            if (!f)
                return;
            // Maintain rolling buffer for training averaging
            this.frameBuffer.push(f);
            if (this.frameBuffer.length > BUFFER_SIZE)
                this.frameBuffer.shift();
            // Live gaze prediction with EMA smoothing
            if (this.modelReady && this.gazeListener) {
                const xin = polyFeatures(f);
                const rawX = dot(xin, this.wx);
                const rawY = dot(xin, this.wy);
                if (this.smoothX === null) {
                    // Seed smoother with first prediction to avoid starting-from-zero drift
                    this.smoothX = rawX;
                    this.smoothY = rawY;
                }
                else {
                    this.smoothX += EMA_ALPHA * (rawX - this.smoothX);
                    this.smoothY = this.smoothY + EMA_ALPHA * (rawY - this.smoothY);
                }
                this.gazeListener({ x: this.smoothX, y: this.smoothY });
            }
        });
        await fm.initialize();
        this.fm = fm;
    }
    _runLoop() {
        this.loopActive = true;
        const tick = async () => {
            if (!this.loopActive || !this.fm || !this.video)
                return;
            if (this.video.readyState >= 2)
                await this.fm.send({ image: this.video });
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
    _features(lm) {
        if (lm.length < 478)
            return null;
        // Where each iris sits *within its own eye opening* — this is the eyeball
        // rotation, decoupled from face size and bbox jitter. Centred around 0
        // (looking straight ≈ 0) so the squared/cross polynomial terms stay small
        // and the ridge solve is well-conditioned.
        const r = this._eyeFraction(lm, IRIS_A, RIGHT_EYE);
        const l = this._eyeFraction(lm, IRIS_B, LEFT_EYE);
        if (!r || !l)
            return null;
        return [r.fx, r.fy, l.fx, l.fy];
    }
    _eyeFraction(lm, irisIdx, e) {
        const iris = lm[irisIdx];
        const inner = lm[e.inner];
        const outer = lm[e.outer];
        const top = lm[e.top];
        const bottom = lm[e.bottom];
        const wRaw = outer.x - inner.x;
        const hRaw = bottom.y - top.y;
        const w = Math.abs(wRaw) < 1e-6 ? (wRaw < 0 ? -1e-6 : 1e-6) : wRaw;
        const h = Math.abs(hRaw) < 1e-6 ? (hRaw < 0 ? -1e-6 : 1e-6) : hRaw;
        return {
            fx: (iris.x - inner.x) / w - 0.5,
            fy: (iris.y - top.y) / h - 0.5,
        };
    }
    _fit() {
        const X = this.training.map(s => polyFeatures(s.features));
        this.wx = ridgeFit(X, this.training.map(s => s.sx), RIDGE_LAMBDA);
        this.wy = ridgeFit(X, this.training.map(s => s.sy), RIDGE_LAMBDA);
        this.modelReady = true;
    }
    _persist() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify({
                training: this.training, wx: this.wx, wy: this.wy,
            }));
        }
        catch { /* quota exceeded */ }
    }
    _restoreModel() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw)
                return;
            const d = JSON.parse(raw);
            this.training = d.training ?? [];
            this.wx = d.wx ?? [];
            this.wy = d.wy ?? [];
            this.modelReady = this.wx.length > 0 && this.wy.length > 0;
        }
        catch { /* corrupt */ }
    }
}
//# sourceMappingURL=MediaPipeFaceMeshEngine.js.map