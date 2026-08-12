/**
 * Zeno UI v2 — keyboard bindings (spec §51, docs/ui/keyboard.md).
 *
 * Data-driven keymap. The manager resolves ink key objects to named actions
 * (data, not hard-coded branches); NO_COLOR/--no-color never re-binds keys.
 */

export type KeyAction =
  | "submit"
  | "newline"
  | "autocomplete"
  | "next"
  | "previous"
  | "interrupt"
  | "exit"
  | "palette"
  | "focusTasks"
  | "focusAgents"
  | "focusDiff"
  | "cyclePermission"
  | "close";

export type KeyScope = "all" | "input" | "overlay" | "busy";

export interface KeySpec {
  /** Primary action when the key matches. */
  action: KeyAction;
  /** Optional focus-scope; defaults to "all". */
  scope?: KeyScope;
}

/** Mirror of the ink useInput callback key shape (kept minimal on purpose). */
export interface InkKey {
  escape?: boolean;
  return?: boolean;
  enter?: boolean; // alias for return on some platforms
  tab?: boolean;
  backspace?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export const DEFAULT_SCOPE: KeyScope = "all";

/** Canonical keymap; first match wins. */
const KEYMAP: Array<{ match: (key: InkKey) => boolean; action: KeyAction }> = [
  { match: (k) => k.escape === true, action: "interrupt" },
  { match: (k) => (k.return === true || k.enter === true) && k.shift !== true, action: "submit" },
  { match: (k) => (k.return === true || k.enter === true) && k.shift === true, action: "newline" },
  { match: (k) => k.tab === true && k.shift !== true, action: "autocomplete" },
  { match: (k) => k.tab === true && k.shift === true, action: "cyclePermission" },
  { match: (k) => k.downArrow === true, action: "next" },
  { match: (k) => k.upArrow === true, action: "previous" },
];

/**
 * Resolve an ink key event to an action, or undefined for no binding.
 *
 * Scope filtering is applied by the caller: a binding applies only when the
 * current focus matches its scope (all scopes match when scope is "all").
 */
export function resolveAction(key: InkKey): KeyAction | undefined {
  const hit = KEYMAP.find((entry) => entry.match(key));
  return hit?.action;
}

/** Actions reserved for a focused view (input / overlay / busy). */
export function scopeOf(action: KeyAction): KeyScope {
  switch (action) {
    case "submit":
    case "autocomplete":
      return "input";
    case "interrupt":
      return "busy";
    default:
      return "all";
  }
}

export const KEYMAP_SNAPSHOT = KEYMAP;