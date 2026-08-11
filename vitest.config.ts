import { defineConfig } from "vitest/config";

// The project has no vitest config by convention; default globbing would pick up
// ClaudeKit's own .cjs hook tests under .claude/. Scope the suite to src/ so only
// the project's colocated tests run.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
