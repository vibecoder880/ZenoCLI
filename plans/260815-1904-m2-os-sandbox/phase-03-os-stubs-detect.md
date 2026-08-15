# Phase 3 — macOS/Windows Stubs + Capability Detection (B3/B4/B5)

**Owner:** controller
**Depends on:** Phase 1.
**Files this phase MAY create/modify:** `src/sandbox/detect.ts`, `src/sandbox/macos.ts`, `src/sandbox/windows.ts`; no changes to linux.ts.

## Requirements

Roadmap B3 (macOS Seatbelt) and B4 (Windows Job Objects) are documented as future work — do **not** implement real isolation. The layer must still report honestly.

### detect.ts

```ts
export async function detectSandbox(): Promise<{ status: SandboxStatus; reason?: string }>
```

- `linux` → probe unshare (B2 detection logic; reuse from linux.ts).
- `darwin` → `{ status: "unsupported", reason: "macOS Seatbelt sandbox not implemented (roadmap B3)" }`.
- `win32` → `{ status: "unsupported", reason: "Windows Job Objects sandbox not implemented (roadmap B4)" }`.
- other → `unsupported`.

Never return `available` when isolation is not real.

### macos.ts / windows.ts

Each exports a `SandboxRuntime` whose:
- `isAvailable()` → `false`
- `status()` → `"unsupported"` with the reason above
- `execute()` → throw `SandboxUnavailableError` (or return a typed failure) — never execute unsandboxed silently.

## Implementation steps

1. Create `src/sandbox/detect.ts` (single source for status).
2. Create `src/sandbox/macos.ts`, `src/sandbox/windows.ts` (stubs).
3. Wire `runtime.ts` to call `detectSandbox()` for status.
4. Add detection tests (pure, no platform dependence): assert unsupported reason strings for darwin/win32 by stubbing `process.platform` is not needed — test the constant branches via injected platform arg if the function is written to accept an optional platform override.

## Tests / validation

- `detect.test.ts` — pass a fake platform/`which` result and assert status mapping (available/degraded/unsupported).
- No real macOS/Windows runtime tests (cannot run on Linux CI) — stub status only.

## Risks / rollback

- Keep stubs import-safe on all platforms (no Node APIs that don't exist cross-platform).
- Do not let `runtime.ts` import `macos.ts` on Linux in a way that breaks bundling — use dynamic import by platform.