import type { TargetInput } from '../types.js';

function getZIndex(el: HTMLElement): number {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const z = parseInt(getComputedStyle(node).zIndex, 10);
    if (!isNaN(z)) return z;
    node = node.parentElement;
  }
  return 0;
}

export class ElementResolver {
  resolveTargets(input: TargetInput): HTMLElement[] {
    if (typeof input === 'string') {
      return Array.from(document.querySelectorAll<HTMLElement>(input));
    }
    if (Array.isArray(input)) {
      return input;
    }
    throw new TypeError('observe() targets must be an HTMLElement array or a CSS selector string');
  }

  findElement(
    gazeX: number,
    gazeY: number,
    targets: HTMLElement[],
    tolerance: number,
  ): HTMLElement | null {
    const candidates: HTMLElement[] = [];

    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (
        gazeX >= r.left - tolerance &&
        gazeX <= r.right + tolerance &&
        gazeY >= r.top - tolerance &&
        gazeY <= r.bottom + tolerance
      ) {
        candidates.push(el);
      }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Multiple overlapping elements — pick highest z-index; ties broken by DOM order (last wins)
    candidates.sort((a, b) => {
      const diff = getZIndex(b) - getZIndex(a);
      if (diff !== 0) return diff;
      // Higher DOM position (later sibling) wins on tie
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    return candidates[0];
  }
}
