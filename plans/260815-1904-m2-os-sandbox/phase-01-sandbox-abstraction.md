# Phase 1 — Sandbox Abstraction (B1)

**Owner:** controller
**Files this phase MAY create/modify:** only `src/sandbox/types.ts`, `src/sandbox/policy.ts`, `src/sandbox/runtime.ts`, `src/sandbox/errors.ts`.

## Requirements

Pure TypeScript contracts for the sandbox layer. No binary execution in this phase.

### types.ts

```ts
export type SandboxStatus = "available" | "degraded" | "unavailable" | "unsupported";

export interface SandboxRequest {
  command: string;           // e.g. `npm test`
  cwd: string;               // workspace root (realpath already applied upstream)
  network: boolean;          // allow network (default true)
  readOnly?: boolean;        // if true: workspace mounted read-only
  env?: Record<string, string>;  // allow-list env to pass in
  timeoutMs?: number;        // default 30000
  memoryMb?: number;         // resource limit, default config
}

export interface SandboxPolicy {
  namespaces: { user: boolean; mount: boolean; pid: boolean; net: boolean; uts: boolean };
  rootfs: { bindReadOnly: string[]; bindReadWrite: string[]; tmpfs: string[] };
  writableWorkspace: boolean;
  envAllowlist: string[];
  resourceLimits?: { cpu?: string; memory?: string; time?: string; nproc?: string; nofile?: string };
  denyReadPaths: string[];   // secret paths never bindable/readable in sandbox
}

export interface SandboxedCommand {
  command: string;
  cwd: string;
  policy: SandboxPolicy;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface SandboxRuntime {
  isAvailable(): Promise<boolean>;
  status(): Promise<SandboxStatus>;
  buildPolicy(request: SandboxRequest): SandboxPolicy;
  execute(request: SandboxedCommand): Promise<ExecutionResult>;
}
```

### policy.ts

`buildPolicy(request)` — pure function. Derives bind/tmpfs lists from the request without touching the FS:
- still binds `/usr /bin /etc /lib /lib64` read-only on Linux.
- workspace gets a private writable tmpfs copy when `request.readOnly !== true`.
- `network` → `namespaces.net` flag.
- denyReadPaths defaults to common secret locations (relative to HOME): `~/.ssh`, `.zenocli`, `.env`, `.git-credentials`.

### errors.ts

- `SandboxError` base, `SandboxUnavailableError`.

### runtime.ts

- `createSandbox(): Promise<SandboxRuntime>` — dispatch by `process.platform`:
  - `linux` → dynamic-import `./linux.js` (implemented Phase 2)
  - `darwin` → `./macos.js` stub (Phase 3)
  - `win32` → `./windows.js` stub (Phase 3)
- `status()` reads `detect.ts` (Phase 3) but keeps a sync `isAvailable()` fast path for platform.

## Implementation steps

1. Create `src/sandbox/types.ts` (contracts above).
2. Create `src/sandbox/policy.ts` (pure `buildPolicy`).
3. Create `src/sandbox/errors.ts`.
4. Create `src/sandbox/runtime.ts` (dispatch; imports linux/macos/windows — stubs initially).
5. Create matching stub test files (no binary dependency).

## Tests / validation

- `src/sandbox/policy.test.ts` — `buildPolicy` returns correct namespaces flags for network on/off, writableWorkspace toggles, denyReadPaths populated, envAllowlist preserved.
- `runtime.test.ts` — `createSandbox()` resolves to a runtime with `status()` reflecting the current platform (linux→available-or-degraded; darwin/win32→unsupported).
- Local: single-file vitest with `--pool=threads --poolOptions.threads.singleThread`.

## Risks / rollback

- Dynamic-importing `./linux.js` before it exists breaks `runtime.ts` — create the Linux file as a stub in Phase 1, fill it in Phase 2.
- `process.platform` detection is synchronous; keep `status()` async to allow real probing later.