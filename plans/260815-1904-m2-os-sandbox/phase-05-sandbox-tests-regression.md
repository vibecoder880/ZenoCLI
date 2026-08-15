# Phase 5 — Sandbox Tests + Regression Suite

**Owner:** controller
**Blocked by:** Phases 1–4 all committed with CI green.
**Files this phase MAY create/modify:** only test files `src/sandbox/*.test.ts` plus the exec/config tests touched in Phase 4. No production-code refactor beyond tests.

## Requirements

Every sandbox guarantee becomes a regression test; the M1 security suite must still pass (workspace, SSRF, redaction, shell-AST, subagent gate).

### 5A. Sandbox unit tests (`src/sandbox/`)

1. **policy.test.ts** — `buildPolicy`:
   - namespaces flags correct for network on/off.
   - writableWorkspace toggles with `readOnly`.
   - denyReadPaths populated for HOME secret paths.
   - envAllowlist preserved.
2. **detect.test.ts** — status mapping via injected platform/probe:
   - linux + unshare-ok → available.
   - linux + userns blocked → degraded.
   - darwin/win32 → unsupported with reason.
   - unknown → unsupported.
3. **linux.test.ts** (`describe.skipIf(process.platform !== "linux")`):
   - benign `echo hello` → stdout "hello", exit 0.
   - workspace write allowed (writes go to private tmpfs, isolated from host).
   - writes to RO system path (`/usr/zeno-canary`) denied.
   - `network:false` command that requires network fails (no egress).
   - resource limit kicks in for a memory/time bomb.
   - secret-path host file not visible inside sandbox.
4. **runtime.test.ts** — dispatch by platform; status non-null.

### 5B. Integration regression

- `exec.test.ts`: sandboxed-path marker when available; degraded/unsupported fallback marker on unsupported platforms; `ToolResult` shape unchanged.
- Re-run M1 corpus (`fs`, `search-ssrf`, `redact`, `shell-ast`, `subagent`, `tool-registry`, `classifier`, `permissions`) — no regressions.

### 5C. Docs

- `docs/architecture.md`: add `src/sandbox/` to module map; extend Security Model with the OS-level sandbox bullet; note degraded/unsupported semantics.
- Roadmap B-phase checkboxes (only if roadmap file exists in repo — it does not; skip).

## Implementation steps

1. Write unit tests per module (5A).
2. Extend `exec.test.ts` (5B).
3. Run full M1+ sandbox corpus locally via single-file vitest.
4. Push; CI ubuntu runs Linux sandbox tests for real; CI windows skips them via `skipIf`.

## Tests / validation

- Every touched file passes locally (single-file vitest, `--pool=threads --poolOptions.threads.singleThread`).
- CI (remote): full `npm run test` + typecheck + lint + build green on ubuntu + windows — this is the sandbox registration gate.
- OS-portable: no hardcoded `/tmp` outside sandbox tests; use `mkdtemp`; symlink tests guarded.

## Risks / rollback

- Sandbox integration may not be re-runnable in parallel (namespaces are heavy) — keep tests sequential within `linux.test.ts`.
- Unprivileged userns flakiness across distros → only assert isolation on kernels/flags verified (this repo's CI + this box); other environments report via `detect` and tests skip when `status !== available`.
- Never let a flaky ns test block CI: wrap probe failures → `it.skip` with reason.