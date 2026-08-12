/**
 * Zeno UI v2 — overlay manager (spec §31, docs/ui/component-spec.md § OverlayLayer).
 *
 * One unified overlay system for command palette, model picker, theme picker,
 * permission prompt, session picker, help, and file picker. An overlay is a
 * small, transient layer above the input; Esc or selection closes it.
 * The manager is state-only; rendering belongs to the shell.
 */

export type OverlayKind =
  | "palette"
  | "model"
  | "theme"
  | "permission"
  | "session"
  | "file"
  | "help";

export interface OverlayState<K extends OverlayKind = OverlayKind> {
  kind: K;
  /** Rows of options (may be empty for free-form overlays like permission). */
  items: string[];
  selectedIndex: number;
  /** Optional prompt/title shown above options. */
  title?: string;
}

/** UI state slices (docs/ui/component-spec.md § UIState). */
export interface UIState {
  overlay: OverlayState | null;
  /** Interrupt request acknowledged by the running loop. */
  interrupted: boolean;
}

export class OverlayManager {
  private overlays: OverlayState[] = [];

  get current(): OverlayState | null {
    return this.overlays[this.overlays.length - 1] ?? null;
  }

  get depth(): number {
    return this.overlays.length;
  }

  open<K extends OverlayKind>(kind: K, partial?: Partial<OverlayState<K>>): OverlayState<K> {
    const overlay: OverlayState<K> = {
      kind,
      items: partial?.items ?? [],
      selectedIndex: partial?.selectedIndex ?? 0,
      title: partial?.title,
    };
    this.overlays.push(overlay);
    return overlay;
  }

  close(): OverlayState | null {
    return this.overlays.pop() ?? null;
  }

  move(offset: number): void {
    const current = this.current;
    if (!current || current.items.length === 0) {
      return;
    }
    const len = current.items.length;
    current.selectedIndex = (current.selectedIndex + offset + len) % len;
  }

  clear(): void {
    this.overlays = [];
  }
}

/** Initial UI state for a fresh shell. */
export function initialUIState(): UIState {
  return { overlay: null, interrupted: false };
}