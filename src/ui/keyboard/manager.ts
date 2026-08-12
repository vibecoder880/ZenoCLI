/**
 * Zeno UI v2 — keyboard manager (docs/ui/keyboard.md § Keyboard manager).
 *
 * Owns the keymap, current focus state, and dispatch. Running work polls
 * `interruptRequested()` instead of being hard-interrupted: the manager
 * converts an Esc into an interrupt marker the loop checks between steps.
 */

import { resolveAction, scopeOf, type InkKey, type KeyAction } from "./bindings.js";

export type Focus = "input" | "overlay" | "busy" | "view";

export class KeyboardManager {
  private interrupt = false;
  private focus: Focus = "input";

  setFocus(focus: Focus): void {
    this.focus = focus;
  }

  getFocus(): Focus {
    return this.focus;
  }

  /** Handle a raw ink key event; returns the resolved action, if handled. */
  handle(key: InkKey): KeyAction | undefined {
    const action = resolveAction(key);
    if (!action) {
      return undefined;
    }

    if (action === "interrupt") {
      if (this.focus === "busy") {
        this.interrupt = true;
      } else {
        // Esc while idle/overlay closes overlays; the app handles "close".
        return "close";
      }
    }

    return this.applies(action) ? action : "close";
  }

  /** Whether an action is permitted in the current focus. */
  applies(action: KeyAction): boolean {
    const scope = scopeOf(action);
    return scope === "all" || scope === this.focus || this.focus === "view";
  }

  /** Whether a running task has requested interruption. */
  interruptRequested(): boolean {
    return this.interrupt;
  }

  /** Clear the interrupt request when the running task observes it. */
  consumeInterrupt(): boolean {
    const pending = this.interrupt;
    this.interrupt = false;
    return pending;
  }

  reset(): void {
    this.interrupt = false;
    this.focus = "input";
  }
}