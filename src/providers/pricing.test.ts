import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing.js";

describe("estimateCostUsd", () => {
  it("estimates cost for a known model", () => {
    expect(estimateCostUsd("openai", "gpt-5.6-luna", 1000, 500)).toBe(0.0008);
  });
});
