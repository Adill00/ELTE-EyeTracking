export type TargetInput = HTMLElement[] | string;
export interface GazePoint {
    x: number;
    y: number;
}
export interface CalibrationPoint {
    x: number;
    y: number;
}
export interface CalibrationData {
    version: number;
    points: CalibrationPoint[];
    timestamp: number;
}
export interface ElementStats {
    elementId: string;
    dwellMs: number;
}
export interface LookEvent {
    element: HTMLElement;
}
export interface CurrentElementEvent {
    element: HTMLElement | null;
}
export interface ModuleEvents {
    lookat: LookEvent;
    lookaway: LookEvent;
    currentElementChanged: CurrentElementEvent;
}
//# sourceMappingURL=types.d.ts.map