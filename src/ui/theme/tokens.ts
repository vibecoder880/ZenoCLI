/**
 * Zeno UI v2 — design tokens.
 *
 * Semantic token names only. Components must never reference raw Ink color
 * names; they read resolved tokens from `useTheme()`. This is the "what" of
 * docs/ui/theme.md — radius=none, border=none, spacing in columns.
 */

export interface ZenoTokens {
  /** Primary body text. */
  text: string;
  /** Secondary / metadata text. */
  muted: string;
  /** Faint hints and placeholders. */
  subtle: string;
  /** Brand accent — active model, highlights. */
  accent: string;
  /** Success / OK states. */
  success: string;
  /** Warning states. */
  warning: string;
  /** Error states. */
  error: string;
}

/** Spacing scale (in terminal columns / rows). */
export const SPACING = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 8,
} as const;

/** Zeno never draws borders or rounded corners. */
export const BORDER = "none" as const;
export const RADIUS = "none" as const;

/** Zeno UI v2 — warm, desaturated default palette (default theme). */
export const ZENO_DARK_TOKENS: ZenoTokens = {
  text: "#e6e6e6",
  muted: "#9ca3af",
  subtle: "#6b7280",
  accent: "#a78bfa",
  success: "#6ee7b7",
  warning: "#f5d04c",
  error: "#f87171",
};

/** Light variant — softened for bright terminal backgrounds. */
export const ZENO_LIGHT_TOKENS: ZenoTokens = {
  text: "#1f2430",
  muted: "#6b7280",
  subtle: "#9ca3af",
  accent: "#7c5cbf",
  success: "#15803d",
  warning: "#b45309",
  error: "#dc2626",
};

/** Terminal-native tokens: use ANSI keyword names so Ink/ANSI resolves them. */
export const SYSTEM_TOKEN = "ansi" as const;