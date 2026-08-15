# Phase 4 — run_command Integration + Config Toggle

**Owner:** controller
**Depends on:** Phases 1–3 (runtime + detect exist).
**Files this phase MAY modify:** `src/agent/tools/exec.ts`, `src/storage/config.ts`, `src/safety/classifier.ts` (only if wording changes needed), tests in `src/agent/tools/exec.test.ts`.

## Requirements

Route `run_command` through the sandbox when available; degrade explicitly (with a warning in tool output) otherwise. Public `ToolResult` contract (`{ output, error? }`) is unchanged.

### exec.ts

In `runCommandTool.execute`:

1. Resolve `ctx.cwd` realpath (already done upstream by fs layer for tools; here mirror the workspace resolution).
2. Determine sandbox intent from config + availability:
   - config `sandbox.enabled !== false` (default true) AND `status() === "available"` → sandboxed path.
   - `status() === "degraded"` → still use sandbox layer so it can refuse or degrade with reason, **and** surface `[sandbox: degraded]` in output.
   - `unsupported`/`unavailable` → run via existing `execAsync`, prepend `[sandbox: unsupported — no OS-level isolation]` to output (single-line, not a hard error, preserving tool usability).
3. Sandboxed path:
   - `runtime.buildPolicy({ command, cwd, network, timeoutMs, env })`.
   - `runtime.execute({ command, cwd, policy, env, timeoutMs })`.
   - Map `ExecutionResult` → `ToolResult` (exitCode → `error` if nonzero, stdout/stderr → output).
4. Keep `ensureSafeCommand(command)` from M1 in place **before** any exec — the AST risk gate is still applied; sandbox is defense-in-depth, not a replacement.

### config.ts

Add a `[sandbox]` TOML section:

```toml
[sandbox]
enabled = true       # set false to disable sandbox for run_command
defaultNetwork = true
```

- Load with defaults; surfaced in `ZenoConfig`.
- Keep unchanged behavior when the section is absent (default on, but degraded/unsupported paths still work).

### classifier.ts

No change required beyond M1 (sandbox block verdicts are separate from classify). Verify only that a sandbox-blocked command still yields `ensureSafeCommand` behavior; a command that passes the AST gate but would be sandbox-limited is allowed through (policy decides isolation, not allow/deny).

## Implementation steps

1. Edit `exec.ts`: add sandbox dispatch + degraded/unsupported output markers.
2. Edit `config.ts`: `[sandbox]` section + `SandboxConfig` type + merge.
3. Extend `exec.test.ts`:
   - with sandbox available (linux/CI): benign command executes sandboxed, returns stdout.
   - degraded / unavailable (windows runner): fallback path returns output with marker, contract intact.

## Tests / validation

- Local single-file vitest for `exec.test.ts` + `config.test.ts` (if exists).
- CI ubuntu: sandboxed path runs; CI windows: unsupported/degraded fallback marker path.
- Verify no `ToolResult` field name changed (public contract).

## Risks / rollback

- Sandboxed exec erroring on workspace copy (large repo) → cap workspace copy size / later use overlay; for M2 use a shallow tmpfs bind of workspace root only (not recursive copy of node_modules), fallback to degraded if copy exceeds budget.
- Mutation isolation: writes inside sandbox are lost on exit by design. Document in tool description that sandboxed writes persist only within the sandboxed command run — matches "workspace writable during the command" semantics.
- Keep `--no-network` only when `network:false`; default `true` preserves existing `run_command` behavior.