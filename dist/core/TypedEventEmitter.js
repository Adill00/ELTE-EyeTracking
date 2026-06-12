// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEventEmitter {
    constructor() {
        this.listeners = {};
    }
    on(event, listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(listener);
    }
    off(event, listener) {
        this.listeners[event]?.delete(listener);
    }
    emit(event, data) {
        this.listeners[event]?.forEach(fn => fn(data));
    }
}
//# sourceMappingURL=TypedEventEmitter.js.map