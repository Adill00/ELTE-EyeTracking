import { TypedEventEmitter } from './core/TypedEventEmitter.js';
import type { CalibrationData, ElementStats, ModuleEvents, TargetInput } from './types.js';
export declare class EyeTracker extends TypedEventEmitter<ModuleEvents> {
    private readonly engine;
    private readonly calibrationManager;
    private readonly resolver;
    private readonly statsManager;
    private readonly pointer;
    private targets;
    private tolerance;
    private currentElement;
    private observing;
    private lastGazeTime;
    private engineStarted;
    private ensureEngineStarted;
    calibrate(): Promise<CalibrationData>;
    observe(targets: TargetInput, tolerance?: number): Promise<void>;
    stop(): Promise<void>;
    getCurrentElement(): HTMLElement | null;
    setPointerVisible(visible: boolean): void;
    loadStats(): ElementStats[];
    resetStats(): void;
    setStatsEnabled(enabled: boolean): void;
    private _onGaze;
}
//# sourceMappingURL=EyeTracker.d.ts.map