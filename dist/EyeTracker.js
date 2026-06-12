import { TypedEventEmitter } from './core/TypedEventEmitter.js';
import { CalibrationManager } from './core/CalibrationManager.js';
import { ElementResolver } from './core/ElementResolver.js';
import { StatisticsManager } from './core/StatisticsManager.js';
import { GazePointer } from './core/GazePointer.js';
import { MediaPipeFaceMeshEngine } from './engines/MediaPipeFaceMeshEngine.js';
export class EyeTracker extends TypedEventEmitter {
    constructor() {
        super(...arguments);
        this.engine = new MediaPipeFaceMeshEngine();
        this.calibrationManager = new CalibrationManager();
        this.resolver = new ElementResolver();
        this.statsManager = new StatisticsManager();
        this.pointer = new GazePointer();
        this.targets = [];
        this.tolerance = 0;
        this.currentElement = null;
        this.observing = false;
        this.lastGazeTime = 0;
        this.engineStarted = false;
    }
    async ensureEngineStarted() {
        if (this.engineStarted)
            return;
        await this.engine.start();
        this.engineStarted = true;
    }
    async calibrate() {
        await this.ensureEngineStarted();
        this.engine.clearTraining();
        const data = await this.calibrationManager.run(this.engine);
        return data;
    }
    async observe(targets, tolerance = 0) {
        await this.ensureEngineStarted();
        this.targets = this.resolver.resolveTargets(targets);
        this.tolerance = Math.max(0, tolerance);
        this.currentElement = null;
        this.lastGazeTime = performance.now();
        this.observing = true;
        this.pointer.setVisible(true);
        this.engine.setGazeListener((point) => this._onGaze(point));
    }
    async stop() {
        if (!this.observing)
            return;
        this.observing = false;
        this.engine.clearGazeListener();
        this.statsManager.save();
        await this.engine.stop();
        this.engineStarted = false;
        this.pointer.setVisible(false);
        this.currentElement = null;
    }
    getCurrentElement() {
        return this.currentElement;
    }
    setPointerVisible(visible) {
        this.pointer.setVisible(visible);
    }
    loadStats() {
        return this.statsManager.load();
    }
    resetStats() {
        this.statsManager.reset();
    }
    setStatsEnabled(enabled) {
        this.statsManager.setEnabled(enabled);
    }
    _onGaze(point) {
        if (!this.observing)
            return;
        this.pointer.update(point.x, point.y);
        const now = performance.now();
        const delta = now - this.lastGazeTime;
        this.lastGazeTime = now;
        if (this.currentElement !== null) {
            this.statsManager.record(this.currentElement, delta);
        }
        const next = this.resolver.findElement(point.x, point.y, this.targets, this.tolerance);
        if (next !== this.currentElement) {
            if (this.currentElement !== null) {
                this.emit('lookaway', { element: this.currentElement });
            }
            if (next !== null) {
                this.emit('lookat', { element: next });
            }
            this.emit('currentElementChanged', { element: next });
            this.currentElement = next;
        }
    }
}
//# sourceMappingURL=EyeTracker.js.map