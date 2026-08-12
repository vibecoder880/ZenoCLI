import { describe, expect, it } from "vitest";
import { resolveAction } from "./bindings.js";
import { KeyboardManager } from "./manager.js";

describe("resolveAction", () => {
  it("maps Enter to submit", () => {
    expect(resolveAction({ return: true })).toBe("submit");
  });

  it("maps Shift+Enter to newline", () => {
    expect(resolveAction({ return: true, shift: true })).toBe("newline");
  });

  it("maps Tab to autocomplete and Shift+Tab to cyclePermission", () => {
    expect(resolveAction({ tab: true })).toBe("autocomplete");
    expect(resolveAction({ tab: true, shift: true })).toBe("cyclePermission");
  });

  it("maps arrows", () => {
    expect(resolveAction({ downArrow: true })).toBe("next");
    expect(resolveAction({ upArrow: true })).toBe("previous");
  });

  it("maps Esc to interrupt", () => {
    expect(resolveAction({ escape: true })).toBe("interrupt");
  });

  it("returns undefined for unbound keys", () => {
    expect(resolveAction({ leftArrow: true })).toBeUndefined();
  });
});

describe("KeyboardManager", () => {
  it("tracks focus and sets interrupt during busy on Esc", () => {
    const manager = new KeyboardManager();
    manager.setFocus("busy");
    manager.handle({ escape: true });
    expect(manager.interruptRequested()).toBe(true);
  });

  it("consumes the interrupt once", () => {
    const manager = new KeyboardManager();
    manager.setFocus("busy");
    manager.handle({ escape: true });
    expect(manager.consumeInterrupt()).toBe(true);
    expect(manager.consumeInterrupt()).toBe(false);
  });

  it("does not set interrupt when not busy", () => {
    const manager = new KeyboardManager();
    manager.handle({ escape: true });
    expect(manager.interruptRequested()).toBe(false);
  });

  it("resets state", () => {
    const manager = new KeyboardManager();
    manager.setFocus("busy");
    manager.handle({ escape: true });
    manager.reset();
    expect(manager.interruptRequested()).toBe(false);
    expect(manager.getFocus()).toBe("input");
  });

  it("returns close for unbound or out-of-scope keys", () => {
    const manager = new KeyboardManager();
    manager.setFocus("input");
    expect(manager.handle({ escape: true })).toBe("close");
  });
});