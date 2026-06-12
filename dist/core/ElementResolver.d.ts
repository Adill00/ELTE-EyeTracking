import type { TargetInput } from '../types.js';
export declare class ElementResolver {
    resolveTargets(input: TargetInput): HTMLElement[];
    findElement(gazeX: number, gazeY: number, targets: HTMLElement[], tolerance: number): HTMLElement | null;
}
//# sourceMappingURL=ElementResolver.d.ts.map