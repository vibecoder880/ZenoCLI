/**
 * Tool registration index — registers all built-in tools.
 * Import and call registerAllTools() at startup.
 */

import { registerTools } from "../tool-registry.js";
import { fsToolDefinitions } from "./fs.js";
import { searchToolDefinitions } from "./search.js";
import { orchestrationToolDefinitions } from "./orchestration.js";
import { execToolDefinitions } from "./exec.js";

export { fsToolDefinitions } from "./fs.js";
export { searchToolDefinitions } from "./search.js";
export { orchestrationToolDefinitions } from "./orchestration.js";
export { execToolDefinitions } from "./exec.js";

/** Register all built-in tools. Call once at app startup. */
export function registerAllTools(): void {
  registerTools([
    ...fsToolDefinitions,
    ...searchToolDefinitions,
    ...orchestrationToolDefinitions,
    ...execToolDefinitions,
  ]);
}
