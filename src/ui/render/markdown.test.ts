import { describe, expect, it } from "vitest";
import { ascii, resolveSymbols, UNICODE_SYMBOLS, ASCII_SYMBOLS } from "./markdown.js";

describe("resolveSymbols", () => {
  it("returns Unicode symbols when supported", () => {
    expect(resolveSymbols(true)).toEqual(UNICODE_SYMBOLS);
  });

  it("returns ASCII fallback when not supported", () => {
    expect(resolveSymbols(false)).toEqual(ASCII_SYMBOLS);
  });
});

describe("ascii", () => {
  it("leaves text unchanged when unicode is supported", () => {
    expect(ascii("✓ Done · 3 files", true)).toBe("✓ Done · 3 files");
  });

  it("degrades decorative glyphs to ASCII when not supported", () => {
    expect(ascii("✓ Read 4 files · × error → next…", false)).toBe(
      "OK Read 4 files . X error -> next..."
    );
  });
});