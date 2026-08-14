import { describe, expect, it } from "vitest";
import { resolveTheme, themeSourceFrom, hydrateCustomThemes } from "./engine.js";
import { ZENO_DARK_TOKENS, ZENO_LIGHT_TOKENS } from "./tokens.js";

describe("resolveTheme", () => {
  it("defaults to system mode and falls back to Zeno Dark without native background", () => {
    const { palette, mode, nativeBackground } = resolveTheme(undefined, {
      nativeBackground: false,
      colorLevel: "truecolor",
    });
    expect(mode).toBe("system");
    expect(nativeBackground).toBe(false);
    expect(palette).toEqual(ZENO_DARK_TOKENS);
  });

  it("uses native ANSI tokens when the terminal reports a native background", () => {
    const { palette, nativeBackground } = resolveTheme({ mode: "system" }, {
      nativeBackground: true,
      colorLevel: "truecolor",
    });
    expect(nativeBackground).toBe(true);
    expect(palette.accent).toBe("magenta");
  });

  it("falls back to Zeno Dark when color level is none even with native background", () => {
    const { palette, nativeBackground } = resolveTheme({ mode: "system" }, {
      nativeBackground: true,
      colorLevel: "none",
    });
    expect(nativeBackground).toBe(false);
    expect(palette).toEqual(ZENO_DARK_TOKENS);
  });

  it("resolves dark mode to Zeno Dark", () => {
    const { palette, mode } = resolveTheme({ mode: "dark" });
    expect(mode).toBe("dark");
    expect(palette).toEqual(ZENO_DARK_TOKENS);
  });

  it("resolves light mode to Zeno Light", () => {
    const { palette, mode } = resolveTheme({ mode: "light" });
    expect(mode).toBe("light");
    expect(palette).toEqual(ZENO_LIGHT_TOKENS);
  });

  it("applies palette overrides last", () => {
    const { palette } = resolveTheme({ mode: "dark", palette: { accent: "red" } });
    expect(palette.accent).toBe("red");
    expect(palette.text).toBe(ZENO_DARK_TOKENS.text);
  });

  it("resolves a named theme", () => {
    const { palette } = resolveTheme({ mode: "named", name: "nord" });
    expect(palette.accent).toBe("#88c0d0");
    expect(palette.success).toBe("#a3be8c");
  });
});

describe("themeSourceFrom", () => {
  it("builds a ThemeSource from color level and background flag", () => {
    expect(themeSourceFrom("truecolor", true)).toEqual({
      colorLevel: "truecolor",
      nativeBackground: true,
    });
  });
});

describe("custom theme hydration", () => {
  it("resolves a hydrated custom theme by name", () => {
    hydrateCustomThemes([
      { name: "my-theme", colors: { text: "#111111", muted: "#222222", subtle: "#333333", accent: "#aa5500", success: "#22cc22", warning: "#cccc22", error: "#cc2222" } },
    ]);
    const { palette } = resolveTheme({ mode: "named", name: "my-theme" });
    expect(palette.accent).toBe("#aa5500");
    expect(palette.text).toBe("#111111");
  });
});