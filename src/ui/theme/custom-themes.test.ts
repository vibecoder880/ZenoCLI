import { describe, expect, it } from "vitest";
import { validateThemeJson } from "./custom-themes.js";
import type { ZenoTokens } from "./tokens.js";

const validColors: ZenoTokens = {
  text: "#ffffff",
  muted: "#888888",
  subtle: "#555555",
  accent: "#7c6df2",
  success: "#00ff00",
  warning: "#ffff00",
  error: "#ff0000",
};

describe("validateThemeJson", () => {
  it("accepts a valid dark theme", () => {
    const result = validateThemeJson({
      name: "my-theme",
      base: "dark",
      colors: validColors,
    });
    expect(result).toEqual({
      name: "my-theme",
      base: "dark",
      colors: validColors,
    });
  });

  it("accepts a valid light theme", () => {
    const result = validateThemeJson({
      name: "my-light",
      base: "light",
      colors: validColors,
    });
    expect(result).not.toBeTypeOf("string");
    if (typeof result !== "string") {
      expect(result.base).toBe("light");
    }
  });

  it("rejects missing name", () => {
    const result = validateThemeJson({
      base: "dark",
      colors: validColors,
    });
    expect(typeof result).toBe("string");
  });

  it("rejects empty name", () => {
    const result = validateThemeJson({
      name: "",
      base: "dark",
      colors: validColors,
    });
    expect(typeof result).toBe("string");
  });

  it("rejects invalid base", () => {
    const result = validateThemeJson({
      name: "bad",
      base: "solarized",
      colors: validColors,
    });
    expect(typeof result).toBe("string");
  });

  it("rejects missing colors", () => {
    const result = validateThemeJson({
      name: "bad",
      base: "dark",
    });
    expect(typeof result).toBe("string");
  });

  it("rejects missing required color token", () => {
    const partial = { ...validColors, accent: "" };
    const result = validateThemeJson({
      name: "bad",
      base: "dark",
      colors: partial,
    });
    expect(typeof result).toBe("string");
  });
});
