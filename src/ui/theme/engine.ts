/**
 * Zeno UI v2 — theme engine.
 *
 * Resolves a configured theme (system | dark | light | named) into concrete
 * ZenoTokens. `system` prefers the terminal's own palette (OpenCode direction)
 * as relayed by `TerminalCapabilities`; it degrades to Zeno Dark when the
 * terminal cannot report a palette.
 */

import {
  ZENO_DARK_TOKENS,
  ZENO_LIGHT_TOKENS,
  SYSTEM_TOKEN,
  type ZenoTokens,
} from "./tokens.js";

export type ThemeMode = "system" | "dark" | "light" | "named";
export type ThemeName = "zeno-dark" | "zeno-light" | "tokyo" | "nord" | "dracula";

export interface ThemeConfig {
  mode?: ThemeMode;
  name?: ThemeName;
  /** Optional semantic-token overrides. */
  palette?: Partial<ZenoTokens>;
}

export interface ThemeSource {
  /** Whether the terminal has a native palette we can rely on. */
  nativeBackground: boolean;
  /** Color level the terminal supports: "truecolor" | "256" | "16" | "none". */
  colorLevel: "truecolor" | "256" | "16" | "none";
}

/**
 * Base token set for a named theme. `system`/`dark`/`light` get their
 * defaults; named themes select from the built-in registry.
 */
function baseTokens(mode: ThemeMode, name?: ThemeName): ZenoTokens {
  switch (mode) {
    case "dark":
      return { ...ZENO_DARK_TOKENS };
    case "light":
      return { ...ZENO_LIGHT_TOKENS };
    case "system":
      // system is resolved by resolveTheme below; the fallback is Zeno Dark.
      return { ...ZENO_DARK_TOKENS };
    case "named":
      return { ...themedTokens(name) };
  }
}

/** Built-in named palettes (docs/ui/theme.md § Phases — Phase 11 adds JSON loading). */
function themedTokens(name?: ThemeName): ZenoTokens {
  switch (name) {
    case "zeno-light":
      return { ...ZENO_LIGHT_TOKENS };
    case "tokyo":
      return {
        text: "#d5d6db",
        muted: "#787c99",
        subtle: "#565a73",
        accent: "#7aa2f7",
        success: "#9ece6a",
        warning: "#e0af68",
        error: "#f7768e",
      };
    case "nord":
      return {
        text: "#d8dee9",
        muted: "#4c566a",
        subtle: "#434c5e",
        accent: "#88c0d0",
        success: "#a3be8c",
        warning: "#ebcb8b",
        error: "#bf616a",
      };
    case "dracula":
      return {
        text: "#f8f8f2",
        muted: "#6272a4",
        subtle: "#44475a",
        accent: "#bd93f9",
        success: "#50fa7b",
        warning: "#f1fa8c",
        error: "#ff5555",
      };
    default:
      return { ...ZENO_DARK_TOKENS };
  }
}

/**
 * Resolve a theme into tokens.
 *
 * - mode "system" → native terminal tokens if the terminal can give them,
 *   else Zeno Dark. `nativeBackground` reports whether we skipped the fallback.
 * - mode "dark" / "light" → the Zeno palettes.
 * - mode "named" → a named theme (zeno-dark/light, tokyo, nord, dracula).
 *
 * Final palette overrides (config.theme.palette) are applied last.
 */
export function resolveTheme(
  config?: ThemeConfig,
  source: ThemeSource = { nativeBackground: false, colorLevel: "truecolor" },
): { palette: ZenoTokens; mode: ThemeMode; nativeBackground: boolean } {
  const mode = config?.mode ?? "system";
  let palette: ZenoTokens;
  let nativeBackground = false;

  if (mode === "system") {
    if (source.nativeBackground && source.colorLevel !== "none") {
      // Native terminal tokens: rely on ANSI keyword mapping so Ink/ANSI
      // resolves them to the terminal's own colors.
      palette = {
        text: "white",
        muted: "gray",
        subtle: "grey",
        accent: "magenta",
        success: "green",
        warning: "yellow",
        error: "red",
      };
      nativeBackground = true;
    } else {
      palette = { ...ZENO_DARK_TOKENS };
    }
  } else {
    palette = baseTokens(mode, config?.name);
  }

  return {
    palette: { ...palette, ...(config?.palette ?? {}) },
    mode,
    nativeBackground,
  };
}

/** Construct a `ThemeSource` from terminal capability flags. */
export function themeSourceFrom(
  colorLevel: "truecolor" | "256" | "16" | "none",
  backgroundDetected: boolean,
): ThemeSource {
  return { colorLevel, nativeBackground: backgroundDetected };
}

/**
 * List all available theme names (built-in + custom).
 * Built-in themes are hardcoded; custom themes are loaded from ~/.zeno/themes/.
 */
export async function listThemes(): Promise<string[]> {
  const builtIn: ThemeName[] = [
    "zeno-dark", "zeno-light", "tokyo", "nord", "dracula",
  ];
  try {
    const { loadCustomThemes } = await import("./custom-themes.js");
    const custom = await loadCustomThemes();
    return [...builtIn, ...custom.map((t) => t.name)];
  } catch {
    return [...builtIn];
  }
}

export { SYSTEM_TOKEN, ZENO_DARK_TOKENS, ZENO_LIGHT_TOKENS };