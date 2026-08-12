# Zeno UI v2 — Component Spec & Event Model

Component contracts for the `src/ui/` tree. Names + props are the public surface; rendering detail lives in each Phase.

## Component tree

```
App
├── Header              (Phase 2)
├── Conversation
│   ├── UserMessage     (Phase 3)
│   ├── AssistantMessage
│   ├── Activity        (Phase 5)
│   ├── TaskBlock       (Phase 6)
│   ├── DiffBlock       (Phase 7)
│   └── AgentActivity   (Phase 9)
├── Input
│   ├── Composer        (Phase 4)
│   ├── Autocomplete
│   └── Attachments
├── Statusline          (Phase 10)
└── OverlayLayer        (Phase 8)
    ├── CommandPalette
    ├── ModelPicker
    ├── PermissionPrompt
    ├── SessionPicker
    ├── ThemePicker
    └── Help
```

## Header (Phase 2)

Compact, ≤ 2 lines, no border, no background block.

- Line 1: `ZENO` (bold, title) `· v{VERSION}` · right-aligned `{provider}/{model} · {gitBranch} · {status}`
- Line 2: `~/{cwd}` · right-aligned context `{pct}%`
- Status: idle → `` ; running → `thinking` ; background agents → `n agents`
- Width-aware: < 80 cols collapses to `ZENO · {model} · {branch}`

Props: `{ version, model, provider, branch, cwd, contextPct, status }`.

## Message blocks (Phase 3)

- `UserMessage {content}` — `› ` prefix, primary-weight text.
- `AssistantMessage {content, streaming}` — streaming appends; finished block is static.
- Markdown: headers, bold, italic, code, lists, tables, links (OSC 8 when supported), diff blocks. Code blocks are indented + muted — **no** background box.
- `NO_COLOR` degrades gracefully.

## Activity (Phase 5)

Replaces the raw tool-log.

```
Reading 4 files…
✓ Read 4 files
```

- Phase 5 `Activity` aggregates tool events into operational lines; details hidden by default.
- Long-running agent: one status line + completion summary; never a log dump.
- Progressive disclosure: `✓ Read 4 files` → `Enter` → file list.

## TaskBlock (Phase 6)

Inline, not a card:

```
Plan

  ✓ Inspect repository
  ✓ Trace auth flow
  ● Implement fix
  ○ Add tests
```

Collapsed: `Plan · 3/5 complete`. Content, not a panel.

## AgentActivity (Phase 9)

Inline background agents:

```
2 agents running
  ● researcher   Investigating OAuth flow
  ● tester       Running integration tests
```

## DiffBlock (Phase 7)

Inline, borderless:

```
src/auth.ts
  - if (!token)
  + if (!token?.trim())
```

Header is text: `3 files changed · +42 -11`. `Enter`/`Up`/`Down` navigate files; inline syntax highlight; accept/reject in Phase 7.

## Input / Composer (Phase 4)

- `Composer` — text, `/` slash family, `@` file picker, `!` shell, history, multiline, paste, clipboard.
- `Autocomplete` — suggestions render under the input line; `Tab` accepts.
- `Attachments` — inline chips.

## Statusline (Phase 10)

Single line, configurable:

```
main* · Sonnet 5 · 18k/128k · $0.06 · 2m41s
```

Sections (each optional): `git branch*` · `model` · `context` · `tokens` · `cost` · `duration` · `agents`. Not a dashboard — one row, right-aligned.

## OverlayLayer (Phase 8)

One unified overlay system: command palette, model picker, theme picker, permission, session picker, help, file picker. Small, transient, `Esc` closes, optional subtle dim. No ASCII boxes.

## Permission prompt (Phase 8)

In-line over the input, terminal visible:

```
Zeno wants to run:  npm install
Directory:          ~/Projects/ZenoCLI
Risk:               low
Enter Allow · a Always allow · d Deny · e Edit policy
```

## Event model

Agent/runtime logic never renders UI directly. It emits events; the UI reacts.

```ts
type ZenoEvent =
  | { type: "session_started" } | { type: "session_ended" }
  | { type: "message_created"; message: ChatLine }
  | { type: "message_streaming"; id: string; chunk: string }
  | { type: "message_completed"; id: string }
  | { type: "task_created"; task: TaskState }
  | { type: "task_updated"; task: TaskState }
  | { type: "task_completed"; taskId: string }
  | { type: "agent_started"; agent: AgentState }
  | { type: "agent_progress"; agentId: string; status: string }
  | { type: "agent_completed"; agentId: string }
  | { type: "tool_started"; toolName: string }
  | { type: "tool_completed"; toolName: string; ok: boolean; summary?: string }
  | { type: "tool_failed"; toolName: string; error: string }
  | { type: "file_changed"; path: string; diff?: string }
  | { type: "verification_started" } | { type: "verification_completed"; result: string }
  | { type: "permission_requested"; request: PermissionRequest }
  | { type: "permission_resolved"; id: string; allow: boolean }
  | { type: "model_changed"; model: string }
  | { type: "context_updated"; used: number; max: number };
```

UI state (mirrors events):

```ts
interface UIState {
  session: SessionState;
  conversation: ConversationState;   // ChatLine[] + streaming
  tasks: TaskState[];
  agents: AgentState[];
  tools: ToolState[];
  input: InputState;
  overlay: OverlayState | null;
  status: StatusState;
  theme: ThemeState;
}
```

## Component rules

- Components read from `UIState`, render, dispatch nothing; the event bus is the only writer.
- Theme tokens only (never raw colors).
- No component draws borders or boxes.
- Virtualize long transcripts; debounce resize; batch streaming updates.