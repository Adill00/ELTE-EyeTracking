import type { GazePoint } from '../types.js';
export interface GazeEngine {
    start(): Promise<void>;
    stop(): Promise<void>;
    setGazeListener(cb: (point: GazePoint) => void): void;
    clearGazeListener(): void;
    train(x: number, y: number): void;
    clearTraining(): void;
}
//# sourceMappingURL=GazeEngine.d.ts.map