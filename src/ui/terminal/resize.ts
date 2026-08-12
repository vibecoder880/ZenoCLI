/**
 * Zeno UI v2 — resize handling (spec §23-24, docs/ui/responsive.md).
 *
 * Debounced terminal-size observer plus responsive width tiers. Width tiers
 * decide which statusline/header sections are visible; they never open panels.
 */

export interface Viewport {
  columns: number;
  rows: number;
}

export type WidthTier = "narrow" | "medium" | "wide" | "ultrawide";

/** Width tiers (docs/ui/responsive.md). */
export function widthTier(columns: number): WidthTier {
  if (columns < 80) return "narrow";
  if (columns < 120) return "medium";
  if (columns < 160) return "wide";
  return "ultrawide";
}

/** Debounced resize notifier — only fires after `delay` ms of quiet. */
export class ResizeObserver {
  private readonly listeners = new Set<(viewport: Viewport) => void>();
  private readonly delay: number;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(delay = 150) {
    this.delay = delay;
  }

  subscribe(listener: (viewport: Viewport) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Report a size change (from ink useStdout or a resize event). */
  notify(columns: number, rows: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      const viewport: Viewport = { columns, rows };
      for (const listener of this.listeners) {
        listener(viewport);
      }
    }, this.delay);
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
  }
}

/** True when the layout should collapse to a compact header/status. */
export function isCompact(width: number): boolean {
  return width < 80;
}