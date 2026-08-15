# Phase 5 — Security Regression Suite + Cleanup

**Owner:** controller (sequential, after Phases 1–4 land)
**Blocked by:** Phases 1, 2, 3, 4 all committed with CI green.
**Files this phase MAY modify:** only test files in `src/**/*.test.ts` (new + expanded) and deletions of dead code listed below. No production-code refactor beyond cleanup.

## Requirements

Turn every fixed vulnerability into a regression test, and remove the dead legacy surface.

### 5A. Attack corpus tests (new `src/safety/security.test.ts` or extend per-module test files — match existing colocated convention; prefer extending each module's `*.test.ts` so failures point at the owning module)

Map each milestone item to a test:

1. **Workspace (Phase 1)**
   - path traversal: `../../etc/passwd`, absolute `/etc/passwd`, `..//`,
   - symlink escape: symlink inside workspace → `/etc/passwd`; read → DENY
   - workspace-root symlink does not bypass
2. **SSRF (Phase 2)**
   - `http://localhost`, `http://127.0.0.1`, `http://[::1]`, `http://169.254.169.254`, `https://0x7f000001`, `https://2130706433`, `https://0177.0.0.1`, `::ffff:127.0.0.1`
   - DNS re-resolution stub: hostname resolves to private IP → blocked
   - redirect to private IP → blocked; redirect count > 3 → blocked
   - non-80/443 port → blocked
3. **Redaction (Phase 3)**
   - env secret value in tool output → `[REDACTED]`
   - auth-profile secret → `[REDACTED]`
   - no false positive on benign text
4. **Shell AST (Phase 4)**
   - destructive analyzed commands → blocked/high (see Phase 4 test list)
   - benign commands allowed

### 5B. Cross-cutting regression

- **Subagent gate (Phase 1):** test that a subagent executing `run_command` with no permission prompt gets blocked; disallowed tool via `allowedTools` still blocked.
- **MCP tools:** add a test that MCP-registered tools still route through `executeTool` (so the redaction wrapper in Phase 3 applies by construction) and receive the same workspace/SSRF guards when they invoke the built-in `fs`/`web_fetch` primitives. (Do not build full MCP server; static assertion on the registry path is enough.)

### 5C. Cleanup

- **Delete `src/agent/tools.ts`** (confirmed dead code — no import sites in repo). Verify once more with `grep -rn "agent/tools" src/` excluding `agent/tools/` before deleting; if an import site is found, stop and report (do not delete silently).
- Remove any now-dead `resolvePath` duplicate or `validateFetchUrlInsecure` deprecation markers left by 1–4 if they are unused — only after confirming zero import sites.
- Update docs that mention the deleted/moved surface (`docs/architecture.md` references `src/agent/tools.ts` if it does) — check and fix.

## Implementation steps

1. Run a final `grep` for dead-code imports.
2. Add/extend regression tests per module (5A + 5B).
3. Delete dead code (5C) only after grep confirms orphan.
4. Local sanity: `npx vitest run` on each touched test file (not full suite).

## Tests / validation

- Every test file it touches passes locally.
- CI (remote): full `npm run test` + typecheck + lint + build must be green — this is the security registration gate: if the corpus passes on CI, milestone is done.
- Cross-platform: CI already runs windows-latest; ensure the new path tests are OS-portable (use `path.join`, temp dirs, avoid `/tmp` hardcoding; symlink creation may need `fs.symlinkSync` which works on Windows too for files, skip silently if `EPERM` on Windows — guard with `try/catch` + `it.skipIf`).

## Risks / rollback

- Deleting `tools.ts` if a hidden import exists → grep first, stop on any hit.
- Windows symlink tests flaky → wrap in `try/catch` + `it.skipIf(process.platform === "win32" && error.code === "EPERM")`; never let a flaky test block CI.
- Keep cleanup orthogonal to Phase 1–4 changes (do not refactor production code here).

## Acceptance

Full security corpus passes on CI (ubuntu + windows); dead `tools.ts` gone; docs that referenced it updated; no production regressions.

Status: DONE | DONE_WITH_CONCERNS | BLOCKED