type Listener<T> = (event: T) => void;
export declare class TypedEventEmitter<Events extends Record<string, any>> {
    private listeners;
    on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void;
    off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void;
    emit<K extends keyof Events>(event: K, data: Events[K]): void;
}
export {};
//# sourceMappingURL=TypedEventEmitter.d.ts.map