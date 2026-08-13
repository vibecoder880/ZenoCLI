import React, { createContext, useContext } from "react";

/**
 * Theme system for the TUI (opencode-style light/dark/custom).
 *
 * Maps semantic keys to Ink color names so components don't hardcode colors.
 * Themes: "dark" (default), "light", or a custom palette from config.theme.
 */

export interface ThemePalette {
  /** Primary accent (headers, active model). */
  primary: string;
  /** Success / OK states. */
  success: string;
  /** Warning states. */
  warning: string;
  /** Muted / secondary text. */
  muted: string;
}

export const DARK_THEME: ThemePalette = {
  primary: "cyan",
  success: "green",
  warning: "yellow",
  muted: "gray",
};

export const LIGHT_THEME: ThemePalette = {
  primary: "blue",
  success: "green",
  warning: "yellowBright",
  muted: "black",
};

/** Build a palette from config.theme, merging onto the base preset. */
export function resolveTheme(
  config?: { theme?: { mode?: "system" | "dark" | "light" | "named"; palette?: Partial<ThemePalette> } }
): ThemePalette {
  const mode = config?.theme?.mode ?? "dark";
  // v1 only supports dark/light; system/named fall back to dark.
  const base = mode === "light" ? LIGHT_THEME : DARK_THEME;
  return { ...base, ...(config?.theme?.palette ?? {}) };
}

const ThemeContext = createContext<ThemePalette>(DARK_THEME);

/** Provide a resolved palette to the TUI component tree. */
export function ThemeProvider({ palette, children }: { palette: ThemePalette; children: React.ReactNode }): React.JSX.Element {
  return <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>;
}

/** Hook to read the active palette inside a component. */
export function useTheme(): ThemePalette {
  return useContext(ThemeContext);
}
