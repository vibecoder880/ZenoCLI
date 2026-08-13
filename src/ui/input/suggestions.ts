/**
 * Zeno UI v2 — Composer suggestions (spec §16, docs/ui/keyboard.md § Composer).
 *
 * Pure, React-free logic for the three trigger families typed into the
 * Composer:
 *
 *   /  slash commands   — filtered from the v1 slash-command catalog
 *   @  file references — paths under the workspace (cwd)
 *   !  shell shortcuts — a small set of common shell prompts
 *
 * The trigger grammar is intentionally small: a trigger char at the start of
 * the input (or after a space) opens a suggestion group for the current token.
 * Accepting a suggestion replaces that token in place.
 */

import { buildSlashCommands } from "../../cli/slash-commands.js";

export type TriggerKind = "/" | "@" | "!";

export interface Suggestion {
  /** Text inserted in place of the token (e.g. "/model" or "src/core/"). */
  value: string;
  label: string;
  description?: string;
}

export interface Trigger {
  kind: TriggerKind | null;
  /** The token being completed, without the trigger char. */
  token: string;
  /** Text before the trigger char (the "command" context), if any. */
  prefix: string;
}

const TRIGGER_RE = /^(.*?\s+)?([/@!])(\S*)$/;

/**
 * Parse the current input into a trigger + token, or null when no trigger.
 *
 * The trigger char must be at the start of the input or after whitespace so a
 * word like `a/b` doesn't open a suggestion. `prefix` is the text before the
 * trigger, including any trailing space, so suggestions re-insert cleanly.
 */
export function parseTrigger(input: string): Trigger | null {
  const match = TRIGGER_RE.exec(input);
  if (match === null) {
    return null;
  }
  const kind = match[2] as TriggerKind;
  return { kind, token: match[3], prefix: match[1] ?? "" };
}

/** File suggestions under `cwd` matching `token` (directories first). */
export async function fileSuggestions(
  token: string,
  cwd: string,
): Promise<Suggestion[]> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const dir = token.length === 0 || token.endsWith("/") ? token : token.slice(0, token.lastIndexOf("/") + 1);
  const base = token.slice(dir.length).toLowerCase();

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(path.join(cwd, dir));
  } catch {
    return [];
  }

  const matches = entries
    .filter((name) => name.toLowerCase().startsWith(base))
    .slice(0, 20);

  return matches
    .map((name): Suggestion => {
      const full = dir + name;
      const isDir = fs.statSync(path.join(cwd, full)).isDirectory();
      const value = isDir ? `${full}/` : full;
      return { value, label: full, description: isDir ? "directory" : "file" };
    })
    .sort((a, b) => {
      const aDir = a.description === "directory" ? 0 : 1;
      const bDir = b.description === "directory" ? 0 : 1;
      return aDir - bDir || a.label.localeCompare(b.label);
    });
}

const SHELL_SHORTCUTS: Suggestion[] = [
  { value: "npm test", label: "npm test", description: "run the test suite" },
  { value: "npm run build", label: "npm run build", description: "compile the project" },
  { value: "npm run lint", label: "npm run lint", description: "lint the codebase" },
  { value: "git status", label: "git status", description: "working tree state" },
  { value: "git diff", label: "git diff", description: "unstaged changes" },
  { value: "git log --oneline -10", label: "git log", description: "recent commits" },
];

function slashSuggestions(token: string): Suggestion[] {
  return buildSlashCommands()
    .filter((cmd) => cmd.command.slice(1).includes(token.toLowerCase()))
    .map((cmd) => ({
      value: cmd.command,
      label: cmd.command,
      description: cmd.description,
    }));
}

function shellSuggestions(token: string): Suggestion[] {
  return SHELL_SHORTCUTS.filter((s) => s.label.includes(token.toLowerCase()));
}

/** Resolve the suggestion list for a parsed trigger. */
export async function filterSuggestions(
  trigger: Trigger,
  cwd: string,
): Promise<Suggestion[]> {
  switch (trigger.kind) {
    case "/":
      return slashSuggestions(trigger.token);
    case "@":
      return fileSuggestions(trigger.token, cwd);
    case "!":
      return shellSuggestions(trigger.token);
    default:
      return [];
  }
}

/**
 * Apply a suggestion: replace the token after the trigger with
 * `suggestion.value`. A trailing space is appended so the user can keep
 * typing after completing.
 */
export function applySuggestion(input: string, suggestion: Suggestion): string {
  const trigger = parseTrigger(input);
  if (trigger === null) {
    return input + suggestion.value + " ";
  }
  // `suggestion.value` already carries its own trigger char (e.g. "/model"),
  // so the raw token (not the trigger) is replaced.
  const insertion = trigger.prefix + suggestion.value;
  return insertion + " ";
}
