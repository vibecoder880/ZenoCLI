/**
 * Zeno UI v2 — Unicode fallback (spec §38/§39, docs/ui/responsive.md).
 *
 * Terminals without box/check glyphs degrade to ASCII. Symbols always render,
 * so state is never conveyed by color alone.
 */

export interface SymbolMap {
  user: string;
  success: string;
  active: string;
  pending: string;
  error: string;
  warning: string;
  action: string;
}

/** Semantic symbols used across the UI (spec §37). */
export const UNICODE_SYMBOLS: SymbolMap = {
  user: "›",
  success: "✓",
  active: "●",
  pending: "○",
  error: "×",
  warning: "!",
  action: "→",
};

/** ASCII fallback for terminals without Unic‌ode glyphs. */
export const ASCII_SYMBOLS: SymbolMap = {
  user: ">",
  success: "OK",
  active: "*",
  pending: "o",
  error: "X",
  warning: "!",
  action: "->",
};

/** Resolve the symbol set for the given capability flags. */
export function resolveSymbols(unicode: boolean): SymbolMap {
  return unicode ? UNICODE_SYMBOLS : ASCII_SYMBOLS;
}

/** Replace common decorative Unicode chars in text output when unicode=off. */
export function ascii(text: string, unicode: boolean): string {
  if (unicode) {
    return text;
  }
  return text
    .replace(/✓/g, "OK")
    .replace(/×/g, "X")
    .replace(/●/g, "*")
    .replace(/○/g, "o")
    .replace(/›/g, ">")
    .replace(/→/g, "->")
    .replace(/…/g, "...")
    .replace(/·/g, ".")
    .replace(/⌄/g, "v");
}