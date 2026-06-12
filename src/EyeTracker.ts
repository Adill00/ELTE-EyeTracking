import { TypedEventEmitter } from './core/TypedEventEmitter.js';
import { CalibrationManager } from './core/CalibrationManager.js';
import { ElementResolver } from './core/ElementResolver.js';
import { StatisticsManager } from './core/StatisticsManager.js';
import { GazePointer } from './core/GazePointer.js';
import { MediaPipeFaceMeshEngine } from './engines/MediaPipeFaceMeshEngine.js';
import type { CalibrationData, ElementStats, GazePoint, ModuleEvents, TargetInput } from './types.js';

export class EyeTracker extends TypedEventEmitter<ModuleEvents> {
  private readonly engine = new MediaPipeFaceMeshEngine();
  private readonly calibrationManager = new CalibrationManager();
  private readonly resolver = new ElementResolver();
  private readonly statsManager = new StatisticsManager();
  private readonly pointer = new GazePointer();

  private targets: HTMLElement[] = [];
  private tolerance = 0;
  private currentElement: HTMLElement | null = null;
  private observing = false;
  private lastGazeTime = 0;
  private engineStarted = false;

  private async ensureEngineStarted(): Promise<void> {
    if (this.engineStarted) return;
    await this.engine.start();
    this.engineStarted = true;
  }

  async calibrate(): Promise<CalibrationData> {
    await this.ensureEngineStarted();
    this.engine.clearTraining();
    const data = await this.calibrationManager.run(this.engine);
    return data;
  }

  async observe(targets: TargetInput, tolerance = 0): Promise<void> {
    await this.ensureEngineStarted();
    this.targets = this.resolver.resolveTargets(targets);
    this.tolerance = Math.max(0, tolerance);
    this.currentElement = null;
    this.lastGazeTime = performance.now();
    this.observing = true;
    this.pointer.setVisible(true);
    this.engine.setGazeListener((point: GazePoint) => this._onGaze(point));
  }

  async stop(): Promise<void> {
    if (!this.observing) return;
    this.observing = false;
    this.engine.clearGazeListener();
    this.statsManager.save();
    await this.engine.stop();
    this.engineStarted = false;
    this.pointer.setVisible(false);
    this.currentElement = null;
  }

  getCurrentElement(): HTMLElement | null {
    return this.currentElement;
  }

  setPointerVisible(visible: boolean): void {
    this.pointer.setVisible(visible);
  }

  loadStats(): ElementStats[] {
    return this.statsManager.load();
  }

  resetStats(): void {
    this.statsManager.reset();
  }

  setStatsEnabled(enabled: boolean): void {
    this.statsManager.setEnabled(enabled);
  }

  private _onGaze(point: GazePoint): void {
    if (!this.observing) return;

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
