import type { ElementStats } from '../types.js';

const STORAGE_KEY = 'eye-tracking-stats-v1';
const STATS_VERSION = 1;
let idCounter = 0;

interface StatsPayload {
  version: number;
  items: ElementStats[];
}

function ensureElementId(el: HTMLElement): string {
  if (!el.dataset.eyeId) {
    el.dataset.eyeId = `eye-${++idCounter}`;
  }
  return el.dataset.eyeId;
}

export class StatisticsManager {
  private map = new Map<string, number>();
  private enabled = true;

  record(el: HTMLElement, deltaMs: number): void {
    if (!this.enabled) return;
    const id = ensureElementId(el);
    this.map.set(id, (this.map.get(id) ?? 0) + deltaMs);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  save(): void {
    const items: ElementStats[] = Array.from(this.map.entries()).map(([elementId, dwellMs]) => ({
      elementId,
      dwellMs,
    }));
    const payload: StatsPayload = { version: STATS_VERSION, items };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  load(): ElementStats[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const payload: StatsPayload = JSON.parse(raw);
      if (payload.version !== STATS_VERSION) return [];
      // Sync in-memory map with persisted data
      this.map.clear();
      for (const item of payload.items) {
        this.map.set(item.elementId, item.dwellMs);
      }
      return payload.items;
    } catch {
      return [];
    }
  }

  reset(): void {
    this.map.clear();
    this.save();
  }

}
