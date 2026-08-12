/**
 * Zeno UI v2 — terminal capabilities (src/ui/terminal/system.ts per spec §51).
 *
 * Detect what the running terminal can do and expose it to the renderer:
 * color level (truecolor/256/16/none), NO_COLOR support, Unicode support,
 * OSC 8 hyperlinks, terminal dimensions, and platform flags. Pure functions
 * take an optional env so they are unit-testable without a real terminal.
 */

export type ColorLevel = "truecolor" | "256" | "16" | "none";

export interface TerminalCapabilities {
  colorLevel: ColorLevel;
  /** true when NO_COLOR=1 (or ZENO_NO_COLOR) forces grayscale output. */
  noColor: boolean;
  /** Unicode box/check glyphs are available. */
  unicode: boolean;
  /** OSC 8 hyperlinks are supported. */
  osc8Links: boolean;
  columns: number;
  rows: number;
  platform: NodeJS.Platform;
  /** Terminal approximates a native background; true when WT_SESSION/KITTY/etc. */
  nativeBackground: boolean;
}

const UNICODE_TERMS = new Set([
  "xterm-256color",
  "xterm-kitty",
  "screen-256color",
  "tmux-256color",
  "alacritty",
  "wezterm",
  "vscode",
  "foot",
  "contour",
]);

/** Detect color level from env/flags. `--no-color` forces Level.None. */
export function detectColorLevel(
  env: NodeJS.ProcessEnv = process.env,
  noColorFlag = false,
): ColorLevel {
  if (noColorFlag || env.NO_COLOR !== undefined || env.ZENO_NO_COLOR !== undefined) {
    return "none";
  }

  if ("FORCE_COLOR" in env && env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") {
    return "truecolor";
  }

  const colorterm = (env.COLORTERM ?? "").toLowerCase();
  // Some terminals set COLORTERM=truecolor/24bit unconditionally; treat as truecolor.
  if (colorterm === "truecolor" || colorterm === "24bit") {
    return "truecolor";
  }

  const term = (env.TERM ?? "").toLowerCase();
  if (term.includes("256color") || term.includes("truecolor") || UNICODE_TERMS.has(term)) {
    return "256";
  }

  if (env.TERM_PROGRAM === "vscode" || env.VSCODE_INJECTION === "1") {
    return "truecolor";
  }

  // Default: assume modern terminal, but a TTY-less run has no color.
  if (env.CI) {
    return "16";
  }
  return "256";
}

/** Detect single/official presence of NO_COLOR. */
export function isNoColor(
  env: NodeJS.ProcessEnv = process.env,
  noColorFlag = false,
): boolean {
  return noColorFlag || env.NO_COLOR !== undefined || env.ZENO_NO_COLOR !== undefined;
}

/** Detect Unicode glyph support from the terminal family. */
export function detectUnicode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const term = (env.TERM ?? "").toLowerCase();
  const program = env.TERM_PROGRAM ?? "";
  const colorterm = (env.COLORTERM ?? "").toLowerCase();

  if (UNICODE_TERMS.has(term) || colorterm.includes("truecolor")) {
    return true;
  }
  if (program === "vscode" || program === "Hyper" || program === "WezTerm") {
    return true;
  }
  // Windows legacy console historically lacked box glyphs. Windows Terminal
  // sets WT_SESSION and is detected via the colorterm/term checks above.
  return !(env.OS?.toLowerCase().includes("windows"));
}

/** Detect OSC 8 hyperlink support (best effort via terminal env). */
export function detectOsc8(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const term = (env.TERM ?? "").toLowerCase();
  if (term.includes("kitty") || term.includes("konsole") || term.includes("alacritty")) {
    return true;
  }
  if (env.WT_SESSION || env.TERM_PROGRAM === "vscode" || env.KITTY_WINDOW_ID) {
    return true;
  }
  return detectUnicode(env); // fallback: most Unicode terminals support OSC 8.
}

/** Terminals known to enable a native user palette (Windows Terminal, kitty, etc.). */
export function detectNativeBackground(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.WT_SESSION || env.KITTY_WINDOW_ID || env.TERM_PROGRAM === "Apple_Terminal");
}

/** Read terminal dimensions; defaults 80×24. */
export function detectDimensions(
  stdout: { columns?: number; rows?: number } | undefined = process.stdout,
): { columns: number; rows: number } {
  return { columns: stdout?.columns ?? 80, rows: stdout?.rows ?? 24 };
}

/** Full snapshot of capability flags for the current process. */
export function detectCapabilities(
  env: NodeJS.ProcessEnv = process.env,
  stdout: { columns?: number; rows?: number } | undefined = process.stdout,
  noColorFlag = false,
): TerminalCapabilities {
  const { columns, rows } = detectDimensions(stdout);
  return {
    colorLevel: detectColorLevel(env, noColorFlag),
    noColor: isNoColor(env, noColorFlag),
    unicode: detectUnicode(env),
    osc8Links: detectOsc8(env),
    columns,
    rows,
    platform: typeof process !== "undefined" ? process.platform : "linux",
    nativeBackground: detectNativeBackground(env),
  };
}