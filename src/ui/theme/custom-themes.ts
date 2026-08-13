/**
 * Zeno UI v2 — custom theme loader.
 *
 * Scans `~/.zeno/themes/*.json` for user-defined themes and returns them
 * as ZenoTokens alongside built-in themes. Malformed files are skipped.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ZenoTokens } from "./tokens.js";

export interface CustomTheme {
  name: string;
  base: "dark" | "light";
  colors: ZenoTokens;
}

const REQUIRED_TOKENS: (keyof ZenoTokens)[] = [
  "text", "muted", "subtle", "accent", "success", "warning", "error",
];

/**
 * Validate a parsed JSON object as a CustomTheme.
 * Returns the validated theme or an error string.
 */
export function validateThemeJson(
  raw: Record<string, unknown>,
): CustomTheme | string {
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    return "missing or empty 'name'";
  }
  if (raw.base !== "dark" && raw.base !== "light") {
    return `'base' must be "dark" or "light", got "${String(raw.base)}"`;
  }
  if (typeof raw.colors !== "object" || raw.colors === null) {
    return "missing 'colors' object";
  }
  const colors = raw.colors as Record<string, unknown>;
  for (const key of REQUIRED_TOKENS) {
    if (typeof colors[key] !== "string" || colors[key].length === 0) {
      return `missing or empty color token '${key}'`;
    }
  }
  return {
    name: raw.name,
    base: raw.base,
    colors: {
      text: colors.text as string,
      muted: colors.muted as string,
      subtle: colors.subtle as string,
      accent: colors.accent as string,
      success: colors.success as string,
      warning: colors.warning as string,
      error: colors.error as string,
    },
  };
}

/**
 * Load all valid custom themes from `~/.zeno/themes/`.
 * Returns empty array if the directory doesn't exist or has no valid themes.
 */
export async function loadCustomThemes(): Promise<CustomTheme[]> {
  const themesDir = join(homedir(), ".zeno", "themes");
  let files: string[];
  try {
    files = await readdir(themesDir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  const themes: CustomTheme[] = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(themesDir, file), "utf-8");
      const raw = JSON.parse(content) as Record<string, unknown>;
      const result = validateThemeJson(raw);
      if (typeof result === "string") {
        // skip malformed file silently
        continue;
      }
      themes.push(result);
    } catch {
      // skip unreadable / unparseable files
    }
  }

  return themes;
}
