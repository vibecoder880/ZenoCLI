import { afterEach, describe, expect, it, vi } from "vitest";
import { isCompact, ResizeObserver, widthTier } from "./resize.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("widthTier", () => {
  it("tiers by columns", () => {
    expect(widthTier(60)).toBe("narrow");
    expect(widthTier(80)).toBe("medium");
    expect(widthTier(120)).toBe("wide");
    expect(widthTier(200)).toBe("ultrawide");
  });
});

describe("isCompact", () => {
  it("true below 80", () => {
    expect(isCompact(79)).toBe(true);
    expect(isCompact(100)).toBe(false);
  });
});

describe("ResizeObserver", () => {
  it("debounces notifications", () => {
    vi.useFakeTimers();
    const observer = new ResizeObserver(150);
    const listener = vi.fn();
    observer.subscribe(listener);

    observer.notify(180, 50);
    observer.notify(181, 51);
    observer.notify(182, 52);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ columns: 182, rows: 52 });
    observer.dispose();
  });

  it("stops notifying after unsubscribe", () => {
    vi.useFakeTimers();
    const observer = new ResizeObserver(10);
    const listener = vi.fn();
    const unsubscribe = observer.subscribe(listener);
    unsubscribe();
    observer.notify(100, 40);
    vi.advanceTimersByTime(20);
    expect(listener).not.toHaveBeenCalled();
    observer.dispose();
  });

  it("dispose clears pending timer", () => {
    vi.useFakeTimers();
    const observer = new ResizeObserver(10);
    const listener = vi.fn();
    observer.subscribe(listener);
    observer.notify(100, 40);
    observer.dispose();
    vi.advanceTimersByTime(20);
    expect(listener).not.toHaveBeenCalled();
  });
});