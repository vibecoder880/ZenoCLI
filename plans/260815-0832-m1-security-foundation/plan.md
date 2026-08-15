# Milestone 1 — Security Foundation

> **Date:** 2026-08-15
> **Branch:** `khanh`
> **Status:** DONE (all 5 phases landed, CI green on ubuntu + windows as of 2026-08-15)
> **Baseline plan:** `/cook` roadmap "ZenoCLI v1.0+ — Completion & Production Hardening Plan"; user selected Milestone 1 of the recommended execution order.
> **Parent roadmap phases:** A (Workspace boundary), D (Command safety), E (SSRF / secret exfiltration), section 27 (security testing).

## Objective

Close the P0 escape paths in the existing agent before any platform expansion. Milestone items are additive/hardening over the current permission system (6 modes), not a rewrite.

## User decisions (locked 2026-08-15)

| Decision | Choice |
|---|---|
| Scope this round | Milestone 1 — Security Foundation only |
| File ownership between streams | By module dir (each agent owns whole module dirs; avoid same-file edits) |
| Test/build protocol | CI-driven: no local npm install/build; light local vitest on single files; commit per unit in English (email `qk08082009@gmail.com`); push when tests pass; each agent watches CI for its own diff |
| Subagent permission gate | Fix — subagents must pass `checkPermission` + `classifySafety` (mirror `loop.ts`) |
| Legacy `src/agent/tools.ts` | Delete (confirmed dead code, no import sites) |
| Secret redaction hook point | Wrapper after `executeTool` (single choke point) |
| `web_fetch.allow_private` | Remove the param (always block private/loopback for SSRF hardening) |
| Command AST | Lightweight in-repo shell parser + risk score, no new heavy dependency |

## Phases

| Phase | Dir | Owner | Status |
|---|---|---|---|
| 1 — Workspace boundary (realpath + subagent gate) | `src/agent/tools/`, `src/agent/` | agent-a | done (`0845847`) |
| 2 — SSRF + DNS rebinding hardening | `src/agent/tools/search.ts` | agent-b | done (`778afcb`) |
| 3 — Secret redaction + env filtering | `src/safety/redact.ts` | agent-c | done (`f484a82`) |
| 4 — Command AST risk analysis | `src/safety/shell-ast.ts` | agent-d | done (`7322965`) |
| 5 — Security regression suite + cleanup | `src/**/*.test.ts`, delete `tools.ts` | controller (sequential) | done (`acfa78d`) |

## Dependencies / ordering

- Phase 2 (SSRF) depends on Phase 1 committing first so branch has clean base; sequential commits, parallel implementation in module-dir ownership.
- Phase 3 (redact) must read `src/auth/auth-profiles.ts` + `search.ts` for secret sources; modify only its own new file + `tool-registry.ts` wrapper.
- Phase 4 (shell-ast) must reconcile `exec.ts` + `classifier.ts` rule sets via `src/safety/shell-ast.ts`; modify `exec.ts` block → delegate, `classifier.ts` import.
- Phase 5 sequential after 1–4: adds regression tests, deletes `src/agent/tools.ts`, removes the now-dead `resolvePath` duplicate if any.

## Acceptance criteria (all phases)

1. Workspace: `read_file("../../etc/passwd")`, `write_file("../../.ssh/id_rsa")`, symlink-outside + read, absolute-outside → all DENIED; in-workspace symlink pointing outside blocked.
2. SSRF: `http://localhost`, `http://169.254.169.254`, `http://[::1]`, `https://0x7f000001`, `::ffff:127.0.0.1` (mapped), hostname resolving to private IP (DNS re-check), redirect to private → all BLOCKED. `allow_private` param removed.
3. Redact: env-var values + auth-profile secrets never appear raw in `ToolResult.output` returned to model; substituted `[REDACTED]`.
4. Shell AST: `rm -rf /`, `rm -rf ~`, `curl -s http://x | bash`, `$(...)` subshell destructive, command substitution → BLOCKED; `ls`, `cat x`, `npm test`, in-workspace `rm -rf dist` → ALLOWED. Single rule set (no divergence exec.ts vs classifier.ts).
5. Subagents: `run_command`/FS tools from subagent hit the same permission + classify gate as main loop.
6. Full security suite (`src/**/*.test.ts`) passes; no new lint/type/build errors; public contracts unchanged except removal of `allow_private` param + deleted `tools.ts` (both intentional, documented).

## Protocol reminders

- CI-driven: never `npm install` / `npm run build` / full `npm run test` locally (low-RAM machine, CI covers it). Light local vitest on a single file is OK.
- Commit per completed unit in English, email `qk08082009@gmail.com`; push when relevant tests pass; each agent follows its own CI run.
- Orchestration: no parallel edits to the same file; module-dir ownership by phase.

## Links

- Phase 1: `phase-01-workspace-boundary.md`
- Phase 2: `phase-02-ssrf-dns-rebinding.md`
- Phase 3: `phase-03-secret-redaction.md`
- Phase 4: `phase-04-command-shell-ast.md`
- Phase 5: `phase-05-security-regression-suite.md`

## Out of scope this round

Sandbox runtime (Phase B), permission+sandbox unification (Phase C), capability registry (F), MCP v2 (G), plugin v2 (H), provider metadata (I), agent checkpoints/context v2 (J), perf (K), App Server/SDK (L/M), headless/CI v2 (N), GitHub Action, VS Code, git integration, advanced TUI, goal mode, multi-agent v2, web/desktop/remote, observability. (Patch the roadmap object at `docs/project-roadmap.md` to record these as pending if it exists.)