/**
 * Zeno UI v2 — theme React provider (Phase 2).
 *
 * Supplies resolved ZenoTokens to the v2 component tree. Distinct from
 * `src/cli/theme.tsx` (4-key ThemePalette) so the two trees can coexist while
 * the old TUI is migrated piece by piece. See docs/ui/theme.md.
 */

import React, { createContext, useContext, useMemo } from "react";
import { resolveTheme } from "./engine.js";
import type { ThemeConfig, ThemeSource } from "./engine.js";
import type { ZenoTokens } from "./tokens.js";

export interface ResolvedTheme {
  palette: ZenoTokens;
  /** The terminal's color level, used by components for fallbacks. */
  colorLevel: ThemeSource["colorLevel"];
  /** True when NO_COLOR applies — components should skip styling. */
  noColor: boolean;
  /** True when using the terminal's native palette instead of Zeno's. */
  nativeBackground: boolean;
}

const ThemeContext = createContext<ResolvedTheme>({
  palette: {
    text: "white",
    muted: "gray",
    subtle: "grey",
    accent: "blue",
    success: "green",
    warning: "yellow",
    error: "red",
  },
  colorLevel: "16",
  noColor: false,
  nativeBackground: false,
});

export interface ThemeProviderProps {
  config?: ThemeConfig;
  source?: ThemeSource;
  noColor?: boolean;
  children: React.ReactNode;
}

export function UiThemeProvider({
  config,
  source,
  noColor = false,
  children,
}: ThemeProviderProps): React.JSX.Element {
  const resolved = useMemo<ResolvedTheme>(() => {
    const { palette, mode, nativeBackground } = resolveTheme(config, source);
    void mode; // mode is informational; consumers read palette/colorLevel.
    return {
      palette,
      noColor,
      colorLevel: source?.colorLevel ?? "truecolor",
      nativeBackground,
    };
  }, [config, source, noColor]);

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}

/** Read the resolved theme from the v2 provider. */
export function useUiTheme(): ResolvedTheme {
  return useContext(ThemeContext);
}