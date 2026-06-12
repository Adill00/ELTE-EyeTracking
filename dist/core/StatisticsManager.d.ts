import type { ElementStats } from '../types.js';
export declare class StatisticsManager {
    private map;
    private enabled;
    record(el: HTMLElement, deltaMs: number): void;
    setEnabled(enabled: boolean): void;
    save(): void;
    load(): ElementStats[];
    reset(): void;
}
//# sourceMappingURL=StatisticsManager.d.ts.map