import type { GazeEngine } from './GazeEngine.js';
import type { GazePoint } from '../types.js';
interface Lm {
    x: number;
    y: number;
    z: number;
}
declare global {
    interface Window {
        FaceMesh: new (cfg: {
            locateFile: (file: string) => string;
        }) => FaceMeshAPI;
    }
}
interface FaceMeshAPI {
    setOptions(o: {
        maxNumFaces?: number;
        refineLandmarks?: boolean;
        minDetectionConfidence?: number;
        minTrackingConfidence?: number;
    }): void;
    onResults(cb: (r: {
        multiFaceLandmarks?: Lm[][];
    }) => void): void;
    initialize(): Promise<void>;
    send(i: {
        image: HTMLVideoElement;
    }): Promise<void>;
    close(): Promise<void>;
}
export declare class MediaPipeFaceMeshEngine implements GazeEngine {
    private gazeListener;
    private running;
    private fm;
    private video;
    private stream;
    private loopActive;
    private frameBuffer;
    private smoothX;
    private smoothY;
    private training;
    private wx;
    private wy;
    private modelReady;
    start(): Promise<void>;
    stop(): Promise<void>;
    setGazeListener(cb: (pt: GazePoint) => void): void;
    clearGazeListener(): void;
    train(x: number, y: number): void;
    clearTraining(): void;
    private _loadScript;
    private _initCamera;
    private _initFaceMesh;
    private _runLoop;
    private _features;
    private _eyeFraction;
    private _fit;
    private _persist;
    private _restoreModel;
}
export {};
//# sourceMappingURL=MediaPipeFaceMeshEngine.d.ts.map