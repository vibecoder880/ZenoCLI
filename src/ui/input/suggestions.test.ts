import { describe, expect, it } from "vitest";
import { applySuggestion, parseTrigger, type Suggestion } from "./suggestions.js";

describe("parseTrigger", () => {
  it("parses a leading slash trigger", () => {
    expect(parseTrigger("/mode")).toEqual({ kind: "/", token: "mode", prefix: "" });
  });

  it("parses a trigger after a space", () => {
    expect(parseTrigger("look at @src/co")).toEqual({
      kind: "@",
      token: "src/co",
      prefix: "look at ",
    });
  });

  it("parses a shell shortcut after a word boundary", () => {
    expect(parseTrigger("run !npm")).toEqual({ kind: "!", token: "npm", prefix: "run " });
  });

  it("returns null for plain text without a trigger", () => {
    expect(parseTrigger("just some words")).toBeNull();
  });

  it("returns null for a slash mid-word", () => {
    expect(parseTrigger("a/b/c")).toBeNull();
  });
});

describe("applySuggestion", () => {
  const suggestion: Suggestion = { value: "/model", label: "/model" };

  it("replaces the token after the trigger in place", () => {
    expect(applySuggestion("/mo", suggestion)).toBe("/model ");
  });

  it("preserves a prefix before the trigger", () => {
    expect(applySuggestion("fix then /mo", suggestion)).toBe("fix then /model ");
  });

  it("appends when there is no trigger", () => {
    expect(applySuggestion("plain", suggestion)).toBe("plain/model ");
  });
});
