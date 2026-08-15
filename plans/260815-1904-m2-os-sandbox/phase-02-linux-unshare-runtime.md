# Phase 2 — Linux unshare Runtime (B2)

**Owner:** controller
**Depends on:** Phase 1 (types/policy exist).
**Files this phase MAY modify:** `src/sandbox/linux.ts`, `src/sandbox/runtime.ts` (stub→real dispatch).

## Requirements

Implement the unshare-based Linux runtime proven feasible in the plan (verified on kernel 6.18 unprivileged).

### Runtime flow (`execute`)

1. `buildPolicy(request)` (from Phase 1).
2. Write a **private mount plan** under a fresh `mkdtemp` host dir `$ROOT`:
   - `mount -t tmpfs tmpfs $ROOT`
   - For each `bindReadOnly` (`/usr /bin /etc /lib /lib64`): create `$ROOT/<dir>` if missing, `mount --bind <hostdir> $ROOT/<dir>`, then `mount -o remount,ro,bind $ROOT/<dir>`.
   - Workspace: `mkdir -p $ROOT/workspace`; when writable, copy/mount workspace writable; when `readOnly`, bind RO.
   - `mount -t tmpfs tmpfs $ROOT/tmp` (writable scratch).
   - `mount --bind /proc $ROOT/proc` or use `--mount-proc`.
3. Environment filter: build `env -i` style allowlist from `request.env` (default minimal `PATH`/`HOME`); **strip** any var matching secret patterns (`*KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*`, `*CREDENTIAL*`, `API_KEY`, `AUTH`).
4. Resource limits via `prlimit` (time, memory, cpu, nproc, nofile).
5. Command shape:

```text
unshare --user --map-root-user --mount --pid --fork      \
  [--net]                                               \
  [--mount-proc]                                        \
  --root <ROOT> --wd <workspace>                        \
  <prlimit prefix> sh -lc '<command>'
```

- `network:false` → add `--net` (no netns → loopback only/no egress).
- Capture stdout/stderr/exitCode; honor `timeoutMs` (kill the unshare tree on timeout).

### Detection (used by `status()`)

- `linux` + `which unshare` present + probe `unshare --user --map-root-user --mount true` exit 0 → `available`.
- userns blocked (`Operation not permitted`) → `degraded` (no real isolation; callers must not silently sandbox).
- anything else → `unavailable`.

### Deny-list check

- Resolve secret paths (`~/.ssh`, auth-profiles, `.env`) and never add them to `bindReadWrite`/`bindReadOnly`; any candidate root path under a deny path is excluded.

## Implementation steps

1. Implement `linuxRuntime.ts` behind `src/sandbox/linux.ts` exporting `LinuxRuntime implements SandboxRuntime`.
2. Add `probe()` + `status()` internal helpers for detection.
3. Replace Phase 1 stub dispatch in `runtime.ts` with real import.
4. Add `src/sandbox/linux.test.ts` — guarded: `describe.skipIf(process.platform !== 'linux')`; run actual sandbox on benign commands and assert stdout/exit; assert write-to-RO-fails; assert network block returns nonzero or no egress.

## Tests / validation

- Local (ubuntu): `src/sandbox/linux.test.ts` — benign `echo`, `pwd`, write to workspace (allowed), write to `/usr/x` (denied), `ls /proc` isolated, `timeout` honored.
- CI ubuntu: same file runs for real; windows runner skips via `skipIf`.

## Risks / rollback

- Mount under userns can be flaky on some distros → wrap ns setup in try/catch, degrade to `degraded` status with reason on failure.
- `--mount-proc` may fail if PROC child unavailable → fall back to bind `/proc`.
- Do not `mount -o remount,ro /` — verified denied on this kernel; bind-only RO plus tmpfs root is the supported path.
- Unprivileged userns can be disabled via `kernel.unprivileged_userns_clone` sysctl → detection covers this (`degraded`).