import { describe, expect, it } from "vitest";
import { checkForUpdates, getCurrentVersion, isOlder } from "./update-checker.js";

describe("isOlder", () => {
  it("returns true when first version is older", () => {
    expect(isOlder("0.1.0", "0.2.0")).toBe(true);
    expect(isOlder("0.1.0", "1.0.0")).toBe(true);
    expect(isOlder("1.0.0", "2.0.0")).toBe(true);
  });

  it("returns false when versions are equal", () => {
    expect(isOlder("1.0.0", "1.0.0")).toBe(false);
    expect(isOlder("0.5.3", "0.5.3")).toBe(false);
  });

  it("returns false when first version is newer", () => {
    expect(isOlder("2.0.0", "1.0.0")).toBe(false);
    expect(isOlder("0.10.0", "0.2.0")).toBe(false);
  });

  it("handles missing patch numbers", () => {
    expect(isOlder("1.0", "1.1")).toBe(true);
    expect(isOlder("1", "2")).toBe(true);
  });
});

describe("getCurrentVersion", () => {
  it("returns a version string", () => {
    const version = getCurrentVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });
});

describe("checkForUpdates", () => {
  it("returns a result object", async () => {
    const result = await checkForUpdates("0.0.0"); // Force "needs update"
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("latest");
    expect(result).toHaveProperty("hasUpdate");
    expect(result).toHaveProperty("message");
    expect(result.current).toBe("0.0.0");
  });

  it("handles network errors gracefully", async () => {
    const result = await checkForUpdates("0.0.0");
    // Either we get a real update info, or a graceful failure
    expect(result.message).toBeDefined();
    expect(typeof result.hasUpdate).toBe("boolean");
  });
});
