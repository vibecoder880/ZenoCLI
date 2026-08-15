# Milestone 2 — OS Sandbox Runtime

> **Date:** 2026-08-15
> **Branch:** `khanh`
> **Status:** IN_PROGRESS (plan being written; implementation after approval)
> **Baseline plan:** `/cook` roadmap "ZenoCLI v1.0+"; user selected Milestone 2 (OS Sandbox) as the next milestone after Milestone 1 (Security Foundation) landed.
> **Parent roadmap phases:** B (OS Sandbox Runtime) — B1 abstraction / B2 Linux / B3 macOS / B4 Windows / B5 capability detection.

## Objective

Give `run_command` a real OS-level isolation boundary, not just a string denylist. Sandbox is the security boundary; the shell-AST risk score (M1) only decides policy/UX. When sandbox is unavailable, `run_command` must degrade explicitly (never silently pretend to sandbox).

## Feasibility (verified on this machine, kernel 6.18, unprivileged)

Ran controlled `unshare` probes (no privileged deps) — all pass:

- `unshare --user --map-root-user` + `--mount` + `--pid --fork` + `--net --uts` — all namespaces enterable unprivileged.
- Inside userns: `tmpfs` mount OK; `--bind /usr` + `remount,ro,bind` OK (system RO achievable).
- Fresh tmpfs `$ROOT`, bind RO `/usr /bin /etc /lib /lib64`, `chroot $ROOT /bin/sh` runs shell; writable `/tmp` (tmpfs) confirmed via `wc -c /tmp/w.txt` = 3.
- Host `/` remount-ro is **denied** (expected) — so we build a private RO root via bind mounts + tmpfs, we do not remount the host.
- CI runner: unshare present in the cloud ubuntu runner (Linux); no bwrap/firejail. Windows + macOS runners return `unsupported` via detection.

## User decisions (locked 2026-08-15)

| Decision | Choice |
|---|---|
| Next milestone | M2 — OS Sandbox Runtime |
| Linux mechanism | unshare/namespace (not bubblewrap — no setuid helper, npm-shippable) |
| Platform scope | Linux full implementation + macOS/Windows interface+detect stubs (unsupported/degraded) |
| Test/build protocol | CI-driven (no local npm install/build; light vitest on single files); commit per unit in English (email `qk08082009@gmail.com`); push when tests pass |
| Fallback when sandbox unavailable | explicit degraded path with warning — never silent |

## Phases

| Phase | Dir | Owner | Status |
|---|---|---|---|
| 1 — Sandbox abstraction (types/policy/runtime/detect/errors) | `src/sandbox/` | controller | pending |
| 2 — Linux unshare runtime | `src/sandbox/linux.ts` | controller | pending |
| 3 — macOS/Windows stubs + capability detect | `src/sandbox/macos.ts, windows.ts, detect.ts` | controller | pending |
| 4 — Integrate into `run_command` + config toggle | `src/agent/tools/exec.ts`, `src/storage/config.ts` | controller | pending |
| 5 — Sandbox tests + regression suite | `src/sandbox/*.test.ts`, extend `src/agent/tools/exec.test.ts` | controller | pending |

## Target module layout (roadmap B1)

```text
src/sandbox/
├── types.ts      # SandboxRuntime iface, SandboxRequest, SandboxPolicy, ExecutionResult
├── policy.ts     # buildPolicy(input): SandboxPolicy
├── runtime.ts    # createSandbox(): SandboxRuntime (dispatch by platform+detect)
├── detect.ts     # isAvailable / isDegraded() → 'available' | 'unavailable' | 'degraded' | 'unsupported'
├── linux.ts      # unshare-based runtime (B2)
├── macos.ts      # stub (B3, future)
├── windows.ts    # stub (B4, future)
├── errors.ts     # SandboxError, SandboxUnavailableError
└── linux.test.ts / policy.test.ts / detect.test.ts / runtime.test.ts
```

```ts
interface SandboxRuntime {
  isAvailable(): Promise<boolean>;
  buildPolicy(input: SandboxRequest): SandboxPolicy;
  execute(request: SandboxedCommand): Promise<ExecutionResult>;
}
```

## Linux runtime design (B2, unshare)

Policy:
- workspace writable (copy workspace into private tmpfs root; writes isolated)
- system fs read-only (bind `/usr /bin /etc /lib /lib64` → RO)
- PID isolation (`--pid --fork --mount-proc`)
- optional network isolation (`--net`, blocked when `policy.network === false`)
- environment filtering (drop secret-pattern vars; keep minimal PATH/HOME)
- child-process control (pidns)
- resource limits (`setpriv`/`prlimit`: cpu, memory, time, fds, processes)
- temporary dir isolation (private tmpfs `/tmp`)
- secret path denylist (cannot read `~/.ssh`, `/root/.ssh`, `.env`, auth-profiles path)

Sandboxed command invocation shape:
```
unshare --user --map-root-user --mount --pid --fork [--net] \
  [--mount-proc] --root <privateRoot> --wd <workspace> \
  sh -lc '<command>'          # wrapped, with env applied
```
plus `prlimit`/`setpriv` prefix for limits, `env -i` style filter, and a deny-list check before the mount plan is built.

## Acceptance criteria

1. `detect.ts` correctly reports `available` (linux, unshare works), `degraded` (no user ns), `unsupported` (windows/macOS stub) — never silently claims sandbox when missing.
2. Linux sandbox executes a benign command and returns `ExecutionResult` (stdout/exit).
3. Sandbox blocks writes to RO system paths (probe: writing `/usr/...` fails), blocks network when `network:false`, truncates resource-hungry commands.
4. `run_command` routes through sandbox when available, falls back with a warning when not — public `ToolResult` contract unchanged.
5. Env filtering drops secret-pattern variables from the sandboxed process.
6. macOS/Windows stubs return `unsupported` with a clear reason; no crash on those platforms.
7. Full security + sandbox suite passes on CI (ubuntu available-branch, windows unsupported-branch); no new lint/type/build errors.
8. Docs updated (`docs/architecture.md` Security Model + module map; roadmap B-phase checkboxes) only where user-visible behavior changed.

## Protocol reminders

- CI-driven: never `npm install` / `npm run build` / full `npm run test` locally (low-RAM machine, CI covers it). Light local vitest on a single file is OK.
- Commit per completed unit in English, email `qk08082009@gmail.com`; push when relevant tests pass.
- Orchestration: module-dir ownership; avoid parallel edits to the same file. No subagent parallel work unless authorized.

## Links

- Phase 1: `phase-01-sandbox-abstraction.md`
- Phase 2: `phase-02-linux-unshare-runtime.md`
- Phase 3: `phase-03-os-stubs-detect.md`
- Phase 4: `phase-04-run-command-integration.md`
- Phase 5: `phase-05-sandbox-tests-regression.md`
