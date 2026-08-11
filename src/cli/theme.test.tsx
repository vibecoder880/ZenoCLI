import { describe, expect, it } from "vitest";
import { DARK_THEME, LIGHT_THEME, resolveTheme } from "./theme.js";

describe("resolveTheme", () => {
  it("defaults to the dark theme", () => {
    expect(resolveTheme()).toEqual(DARK_THEME);
  });

  it("uses the light theme when configured", () => {
    expect(resolveTheme({ theme: { mode: "light" } }).primary).toBe(LIGHT_THEME.primary);
  });

  it("merges custom palette overrides onto the base", () => {
    const palette = resolveTheme({ theme: { palette: { primary: "magenta" } } });
    expect(palette.primary).toBe("magenta");
    // Unset keys keep the dark defaults.
    expect(palette.success).toBe(DARK_THEME.success);
  });

  it("merges custom palette onto the light base when mode is light", () => {
    const palette = resolveTheme({ theme: { mode: "light", palette: { warning: "red" } } });
    expect(palette.warning).toBe("red");
    expect(palette.primary).toBe(LIGHT_THEME.primary);
  });
});