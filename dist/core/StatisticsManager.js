const STORAGE_KEY = 'eye-tracking-stats-v1';
const STATS_VERSION = 1;
let idCounter = 0;
function ensureElementId(el) {
    if (!el.dataset.eyeId) {
        el.dataset.eyeId = `eye-${++idCounter}`;
    }
    return el.dataset.eyeId;
}
export class StatisticsManager {
    constructor() {
        this.map = new Map();
        this.enabled = true;
    }
    record(el, deltaMs) {
        if (!this.enabled)
            return;
        const id = ensureElementId(el);
        this.map.set(id, (this.map.get(id) ?? 0) + deltaMs);
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    save() {
        const items = Array.from(this.map.entries()).map(([elementId, dwellMs]) => ({
            elementId,
            dwellMs,
        }));
        const payload = { version: STATS_VERSION, items };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        try {
            const payload = JSON.parse(raw);
            if (payload.version !== STATS_VERSION)
                return [];
            // Sync in-memory map with persisted data
            this.map.clear();
            for (const item of payload.items) {
                this.map.set(item.elementId, item.dwellMs);
            }
            return payload.items;
        }
        catch {
            return [];
        }
    }
    reset() {
        this.map.clear();
        this.save();
    }
}
//# sourceMappingURL=StatisticsManager.js.map