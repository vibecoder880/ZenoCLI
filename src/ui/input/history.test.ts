import { describe, expect, it } from "vitest";
import { PromptHistory } from "./history.js";

describe("PromptHistory", () => {
  it("starts empty", () => {
    const h = new PromptHistory();
    expect(h.size).toBe(0);
    expect(h.navigate("up")).toBeNull();
  });

  it("recalls prompts newest-first", () => {
    const h = new PromptHistory();
    h.push("first");
    h.push("second");
    h.push("third");
    expect(h.navigate("up")).toBe("third");
    expect(h.navigate("up")).toBe("second");
    expect(h.navigate("up")).toBe("first");
  });

  it("moves back down after going up", () => {
    const h = new PromptHistory();
    h.push("first");
    h.push("second");
    expect(h.navigate("up")).toBe("second");
    expect(h.navigate("up")).toBe("first");
    expect(h.navigate("down")).toBe("second");
    expect(h.navigate("down")).toBeNull();
  });

  it("ignores empty and duplicate consecutive prompts", () => {
    const h = new PromptHistory();
    h.push("");
    h.push("same");
    h.push("same");
    expect(h.size).toBe(1);
  });

  it("bounded by max", () => {
    const h = new PromptHistory(2);
    h.push("a");
    h.push("b");
    h.push("c");
    expect(h.size).toBe(2);
    expect(h.navigate("up")).toBe("c");
  });
});
