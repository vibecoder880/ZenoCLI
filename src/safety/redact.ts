/**
 * Secret redaction for tool output.
 *
 * Secrets come from two sources:
 * 1. Environment variables whose keys match secret-ish patterns (KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_KEY|AUTH)
 *    or values with length >= 12 (skipping *PATH*, empty, or length < 4).
 * 2. Auth profiles from src/auth/auth-profiles.ts (apiKey/token values), loaded via the store loader.
 *
 * Both sources are wrapped in try/catch so redaction never crashes a run.
 */

import { AuthProfileStore } from "../auth/auth-profiles.js";

/** Secret key patterns that indicate a sensitive environment variable. */
const SECRET_KEY_PATTERNS = [
  /KEY$/i,
  /TOKEN$/i,
  /SECRET$/i,
  /PASSWORD$/i,
  /PASSWD$/i,
  /CREDENTIAL$/i,
  /API_KEY$/i,
  /AUTH$/i,
];

/** Maximum number of sensitive values to collect (cap for performance). */
const MAX_SENSITIVE_VALUES = 256;

/** Cache for collected sensitive values to avoid repeated collection. */
let sensitiveValuesCache: string[] | null = null;

/**
 * Collects all sensitive values from environment variables and auth profiles.
 * Returns a deduplicated array sorted by length descending (longest first)
 * to ensure longest-match priority in redaction.
 */
export function collectSensitiveValues(): string[] {
  if (sensitiveValuesCache !== null) {
    return sensitiveValuesCache;
  }

  const values = new Set<string>();

  // 1. Collect from environment variables
  try {
    for (const [key, value] of Object.entries(process.env)) {
      if (!value || value.length < 4) {
        continue;
      }

      // Check if key matches secret-ish pattern
      const isSecretKey = SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));

      // Skip PATH-like variables ONLY if they don't match secret patterns
      // This allows SECRET_PATH_KEY (matches KEY pattern) to be collected
      const isPathLike = key.toUpperCase().includes("PATH") && !isSecretKey;
      if (isPathLike) {
        continue;
      }

      // Include if secret key pattern matches OR value is long enough (>= 12)
      if (isSecretKey || value.length >= 12) {
        values.add(value);
        if (values.size >= MAX_SENSITIVE_VALUES) {
          break;
        }
      }
    }
  } catch {
    // Ignore env collection errors
  }

  // 2. Collect from auth profiles
  try {
    const store = new AuthProfileStore();
    const profiles = store.listProfiles();

    for (const profile of profiles) {
      if (profile.type === "api_key" && profile.key) {
        values.add(profile.key);
        if (values.size >= MAX_SENSITIVE_VALUES) break;
      }
      if (profile.type === "oauth") {
        if (profile.access) {
          values.add(profile.access);
          if (values.size >= MAX_SENSITIVE_VALUES) break;
        }
        if (profile.refresh) {
          values.add(profile.refresh);
          if (values.size >= MAX_SENSITIVE_VALUES) break;
        }
      }
      if (profile.type === "token" && profile.token) {
        values.add(profile.token);
        if (values.size >= MAX_SENSITIVE_VALUES) break;
      }
    }
  } catch {
    // Ignore auth profile errors - redaction must never crash
  }

  // Convert to array and sort by length descending (longest first)
  sensitiveValuesCache = Array.from(values).sort((a, b) => b.length - a.length);
  return sensitiveValuesCache;
}

/**
 * Clears the sensitive values cache. Useful for tests.
 */
export function clearSensitiveValuesCache(): void {
  sensitiveValuesCache = null;
}

/**
 * Redacts all occurrences of sensitive values in the given text.
 * Uses longest-match-first strategy to avoid partial-substring leaks.
 * Case-sensitive matching.
 */
export function redactSensitive(text: string): string {
  if (!text || text.length === 0) {
    return text;
  }

  const secrets = collectSensitiveValues();
  if (secrets.length === 0) {
    return text;
  }

  let result = text;
  for (const secret of secrets) {
    if (secret.length < 4) continue; // Safety: skip very short values
    // Escape regex special characters for literal string matching
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "g");
    result = result.replace(regex, "[REDACTED]");
  }
  return result;
}

/**
 * Tool names that should always have their output redacted.
 * These tools can return file contents, command output, web fetch bodies, etc.
 * that may contain secrets.
 */
const REDACT_DENYLIST = new Set<string>([
  "run_command",
  "web_fetch",
  "read_file",
  "edit_file",
  "write_file",
  "grep",
  // MCP tools are dynamically named with "mcp__" prefix
]);

/**
 * Returns true if the tool's output should be redacted.
 * Redacts for all tools that can return file/command/web content to the model.
 * Keeps a denylist of tool names we want to always redact.
 * Does not redact orchestration-only content like ask_user.
 */
export function shouldRedactTool(name: string): boolean {
  if (REDACT_DENYLIST.has(name)) {
    return true;
  }
  // MCP tools: any tool starting with "mcp__"
  if (name.startsWith("mcp__")) {
    return true;
  }
  return false;
}