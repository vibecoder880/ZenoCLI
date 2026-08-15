# Phase 1 — Workspace Boundary (realpath + subagent gate)

**Owner:** agent-a (module-dir ownership: `src/agent/tools/*.ts` + `src/agent/subagent.ts`)
**Blocked by:** none (first phase, clean base on `khanh`)
**Files agent-a MAY modify:** `src/agent/tools/fs.ts`, `src/agent/tools/fs.test.ts`, `src/agent/subagent.ts`, `src/agent/subagent.test.ts` (if exists); `src/agent/tools/index.ts` re-export if signature changes.

## Requirements

1. `resolvePath()` (currently `fs.ts:19-32`) must do real containment:
   - After `path.resolve`, also resolve symlinks via `fs.realpathSync`/`realpath` on the **parent chain + target**, then re-check `path.relative(workspaceRoot, realTarget)`.
   - The workspace root itself must be `realpath`'d too (so a symlinked CWD does not bypass).
   - Reject if real target is outside — same `DENY` error shape as today (`Path "... " escapes the workspace and was blocked.`).
   - Keep the lexical check as a fast first pass (cheap `..`/absolute rejection) before the realpath pass (avoid TOCTOU where check and I/O are separate: pass the real-resolved path into the subsequent `readFile`/`writeFile` instead of re-resolving).
2. Rewire the 6 fs tools (`read_file`, `write_file`, `edit_file`, `list_dir`, `glob`, `grep`) so they use the realpath-confined path for the actual filesystem op — not the original string path.
3. Subagent gate: in `src/agent/subagent.ts` around line 256-265, before `executeTool`, run the same `checkPermission(name, args, options.permission)` + `classifySafety(name, args, cwd)` flow the main loop uses (`loop.ts`), so subagents no longer bypass permission/classify. Keep the existing `allowedTools` whitelist as an additional filter. Subagents must also get the same `permission` config passed down from their parent context.

## Implementation steps

1. `fs.ts`: split `resolvePath` into `resolvePath(cwd, targetPath)` (lexical, throws on escape) + `resolveRealPath(cwd, targetPath)` (realpath chain, throws on real-escape). Update each tool's `execute` to call `resolveRealPath` and use its result for the I/O.
2. `subagent.ts`: add permission/classify gate mirroring `loop.ts`; thread `permission` config through the subagent execution context.
3. Update `fs.test.ts`: add cases
   - `read_file("../../etc/passwd")` → DENY
   - `write_file("../../.ssh/id_rsa")` → DENY
   - in-workspace symlink → `/etc/passwd`, then `read_file(symlink)` → DENY (create symlink in temp workspace in test)
   - workspace-root symlink (CWD under a symlinked dir) does not silently escape
   - in-workspace absolute + relative reads still ALLOWED
4. Local sanity: run `npx vitest run src/agent/tools/fs.test.ts` only.

## Tests / validation

- `fs.test.ts` (expanded) — the 5 new cases above + existing confinement cases still pass.
- `subagent.test.ts` (if present) — subagent FS/exec paths now require permission; add a case where a disallowed tool is blocked.
- CI (remote, on push): full `npm run test` + typecheck + lint + build.

## Risks / rollback

- TOCTOU: mitigated by passing the resolved real path into the I/O, not re-resolving.
- Symlink behavior change: in-workspace symlinks that point at another in-workspace real path must still work (realpath stays inside workspace). Test this. If a legit use breaks, log and document, do not silently allow escape.
- If feature flag needed to avoid breaking TUI workflows, gate the realpath pass behind `ZENO_STRICT_WORKSPACE` (default on) — but prefer no flag unless a real break surfaces.

## Acceptance

Workspace DENY matrix from `plan.md` item 1 passes; no regression in benign in-workspace fs operations in `fs.test.ts` and any caller in `tools/index.ts`.

Status: DONE | DONE_WITH_CONCERNS | BLOCKED (report back per orchestration-status protocol)