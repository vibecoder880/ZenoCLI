import { describe, expect, it } from "vitest";
import { initialUIState, OverlayManager } from "./overlay-manager.js";

describe("OverlayManager", () => {
  it("opens and reads the current overlay", () => {
    const manager = new OverlayManager();
    const overlay = manager.open("model", { items: ["a", "b"] });
    expect(manager.current).toBe(overlay);
    expect(overlay.kind).toBe("model");
    expect(overlay.items).toEqual(["a", "b"]);
  });

  it("closes the top overlay", () => {
    const manager = new OverlayManager();
    manager.open("palette", { items: ["x"] });
    manager.open("model", { items: ["a"] });
    expect(manager.current?.kind).toBe("model");
    expect(manager.close()?.kind).toBe("model");
    expect(manager.current?.kind).toBe("palette");
  });

  it("move wraps selection", () => {
    const manager = new OverlayManager();
    manager.open("model", { items: ["a", "b", "c"], selectedIndex: 0 });
    manager.move(-1);
    expect(manager.current?.selectedIndex).toBe(2);
    manager.move(1);
    expect(manager.current?.selectedIndex).toBe(0);
  });

  it("move is a no-op without items", () => {
    const manager = new OverlayManager();
    manager.open("permission");
    manager.move(1);
    expect(manager.current?.selectedIndex).toBe(0);
  });

  it("clear resets to no overlay", () => {
    const manager = new OverlayManager();
    manager.open("help");
    manager.open("session");
    manager.clear();
    expect(manager.current).toBeNull();
  });

  it("initial UI state has no overlay", () => {
    expect(initialUIState()).toEqual({ overlay: null, interrupted: false });
  });
});