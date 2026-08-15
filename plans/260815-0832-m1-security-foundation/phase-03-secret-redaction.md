# Phase 3 — Secret Redaction + Environment Filtering

**Owner:** agent-c (module-dir ownership: new `src/safety/redact.ts` + `src/agent/tool-registry.ts`)
**Blocked by:** Phase 1 (clean base only; no code dependency).
**Files agent-c MAY modify:** new `src/safety/redact.ts`, new `src/safety/redact.test.ts`, `src/agent/tool-registry.ts`, `src/agent/tool-registry.test.ts`. Do NOT touch other files.

## Requirements

Today `ToolResult.output` is passed raw to the model (loop.ts appends content straight through; exec stdout/stderr and web_fetch bodies are raw). Milestone: secrets never reach the model.

1. Create `src/safety/redact.ts` exporting:
   - `collectSensitiveValues(): string[]` — reads `process.env` values (skip `*PATH*`, empty, length<4; cap total list, e.g. 64 entries) + secrets from `src/auth/auth-profiles.ts` (load profiles, collect `apiKey`/`token` values if readable; wrap in try/catch so redaction never crashes the run).
   - `redactSensitive(text: string): string` — replaces every longest-match occurrence of a sensitive value in `text` with `[REDACTED]` (case-sensitive, matches that exact secret). Prioritize longest matches to avoid partial-substring leaks.
   - `shouldRedactTool(name: string): boolean` — redact for all tools that can return file/command/web content to the model; keep to a denylist of tool names we want to always redact (`run_command`, `web_fetch`, `read_file`, `edit_file`, `write_file`, `grep`, plus MCP tools by default). No redaction of `ask_user`/orchestration-only content.
2. Wire into the single choke point: modify `executeTool()` in `src/agent/tool-registry.ts` to wrap `result.output` through `redactSensitive()` before returning (post-`executeTool` wrapper per user decision). This covers every caller: loop, subagent (once subagent gate fixed in Phase 1), MCP tools routed through registry.
3. Also wrap any error strings in `ToolResult.error` that may contain paths/secrets (paths are less sensitive, but keep error handling symmetrical).
4. `redact.test.ts`: set fake env secrets + fake auth profile, assert:
   - tool output containing the env secret value → `[REDACTED]`
   - web_fetch body containing a fake secret → redacted
   - no-op for text without secrets (no false positives for short/common strings)
   - longest-match wins (secret `abc` beats prefix `ab`)
   - redaction never throws when auth profile unreadable (try/catch)

## Implementation steps

1. `redact.ts` per API above (document why env+auth are the secret sources; reference `auth-profiles.ts` import).
2. `tool-registry.ts`: wrap `executeTool` result with `redactSensitive` on output/error; keep the existing error shape (`{output, error}`).
3. Test file, then local sanity: `npx vitest run src/safety/redact.test.ts`.

## Tests / validation

- `redact.test.ts` — 5 cases above.
- `tool-registry.test.ts` — assert output redacted for a tool; existing registry tests still pass.
- CI (remote): full suite.

## Risks / rollback

- **False positives**: redacting common short strings (e.g. a 5-char env value like `DEBUG=1` could over-redact). Mitigate: only redact values where `key` matches a secret-ish name (`KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_KEY|AUTH`, cap list) OR value length ≥ 12. Document the trade-off; don't over-engineer.
- **Performance**: string scan on every output; keep the sensitive list small (cap) and skip empty text; acceptable for CLI.
- **Breaking public contract?** No signature changes; output content changes (redacted) is intentional + documented.

## Acceptance

Secrets from `process.env` and auth profiles never appear raw in tool output seen by the model; `[REDACTED]` substituted; no crash when profile unreadable; no regression on tool-registry behaviors.

Status: DONE | DONE_WITH_CONCERNS | BLOCKED