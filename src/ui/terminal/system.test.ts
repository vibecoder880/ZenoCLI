import { describe, expect, it } from "vitest";
import {
  detectCapabilities,
  detectColorLevel,
  detectDimensions,
  detectNativeBackground,
  detectOsc8,
  detectUnicode,
  isNoColor,
} from "./system.js";

describe("detectColorLevel", () => {
  it("returns none when NO_COLOR is set", () => {
    expect(detectColorLevel({ NO_COLOR: "1" })).toBe("none");
  });

  it("returns none when ZENO_NO_COLOR or the flag is set", () => {
    expect(detectColorLevel({}, true)).toBe("none");
    expect(detectColorLevel({ ZENO_NO_COLOR: "1" })).toBe("none");
  });

  it("honors FORCE_COLOR", () => {
    expect(detectColorLevel({ FORCE_COLOR: "1" })).toBe("truecolor");
  });

  it("detects truecolor via COLORTERM", () => {
    expect(detectColorLevel({ COLORTERM: "truecolor" })).toBe("truecolor");
  });

  it("detects 256-color via TERM", () => {
    expect(detectColorLevel({ TERM: "xterm-256color" })).toBe("256");
  });
});

describe("isNoColor", () => {
  it("true on env or flag", () => {
    expect(isNoColor({ NO_COLOR: "" })).toBe(true);
    expect(isNoColor({}, true)).toBe(true);
    expect(isNoColor({})).toBe(false);
  });
});

describe("detectUnicode", () => {
  it("true for modern terminals", () => {
    expect(detectUnicode({ TERM: "xterm-256color" })).toBe(true);
    expect(detectUnicode({ TERM_PROGRAM: "WezTerm" })).toBe(true);
  });

  it("false on legacy Windows console", () => {
    expect(detectUnicode({ OS: "Windows_NT", TERM: "" })).toBe(false);
  });
});

describe("detectOsc8", () => {
  it("true for kitty/terminal-program", () => {
    expect(detectOsc8({ TERM: "xterm-kitty" })).toBe(true);
    expect(detectOsc8({ TERM_PROGRAM: "vscode" })).toBe(true);
    expect(detectOsc8({ WT_SESSION: "abc" })).toBe(true);
  });
});

describe("detectNativeBackground", () => {
  it("true for Windows Terminal / kitty / Apple Terminal", () => {
    expect(detectNativeBackground({ WT_SESSION: "abc" })).toBe(true);
    expect(detectNativeBackground({ TERM_PROGRAM: "Apple_Terminal" })).toBe(true);
    expect(detectNativeBackground({})).toBe(false);
  });
});

describe("detectDimensions", () => {
  it("defaults to 80x24 without stdout", () => {
    expect(detectDimensions(undefined)).toEqual({ columns: 80, rows: 24 });
  });

  it("reads from stdout", () => {
    expect(detectDimensions({ columns: 180, rows: 50 })).toEqual({ columns: 180, rows: 50 });
  });
});

describe("detectCapabilities", () => {
  it("composes the full capability snapshot", () => {
    const caps = detectCapabilities(
      { TERM: "xterm-kitty", WT_SESSION: "abc" },
      { columns: 160, rows: 40 },
    );
    expect(caps.colorLevel).toBe("256");
    expect(caps.unicode).toBe(true);
    expect(caps.osc8Links).toBe(true);
    expect(caps.nativeBackground).toBe(true);
    expect(caps.columns).toBe(160);
    expect(caps.rows).toBe(40);
  });
});