---
phase: 5
title: "TUI Parity với Claude Code"
status: completed
priority: P1
effort: "12h"
dependencies: []
---

# Phase 5: TUI Parity với Claude Code

## Overview
Nâng cấp TUI hiện tại thành giao diện polished giống Claude Code: welcome banner,
sticky status bar, footer hints, multi-line input, slash palette có nhóm.
`neuro` (no args) trở thành entrypoint TUI mặc định đã có (src/index.ts:191-202),
chỉ cần polish thêm.

## Requirements

### Functional
- `neuro` (no subcommand) mở TUI polished trong < 2s
- Welcome banner hiển thị logo + model + session + auth status
- Nếu thiếu auth/key → banner hướng dẫn chạy `neuro auth <provider>` thay vì crash
- Sticky status bar: mode · session ID · cost · permission · provider/model
- Footer hint: `Esc exit · / commands · Shift+Tab permission · Shift+Enter newline · ↑↓ history`
- Multi-line input: Enter submit, Shift+Enter chèn newline
- Slash palette: gom nhóm (Mode / Session / Debug / Info), highlight khi cuộn
- MessageList màu riêng: user=cyan, assistant=green, system=dim, error=red
- AgentStatus: stream event realtime có màu (tool_start=yellow, error=red, ok=green)

### Non-Functional
- Tất cả test hiện tại (221+) pass
- ESLint + typecheck clean
- Không thêm dependency mới (dùng `ink`, `ink-text-input` đã có)
- Không breaking CLI public interface
- Startup không tăng > 500ms

## Architecture

### Layout (top → bottom)
```
┌──────────────────────────────────────────────┐
│ ▌ NeuroCLI                          v0.2.0  │  ← Header (sticky)
│ Provider: openai · Model: gpt-4.1-mini      │
│ Session: abc-123 · Mode: chat · $0.0012     │
├──────────────────────────────────────────────┤
│ ▌ Agent status                              │  ← AgentStatus (collapsible)
│ > read_file package.json                    │
│ + found 24 lines                            │
├──────────────────────────────────────────────┤
│ ▌ Conversation                              │  ← MessageList (scrollable)
│ You: xin chào                              │
│ Assistant: chào bạn!                        │
│ ...                                        │
├──────────────────────────────────────────────┤
│ ▌ / commands  (chỉ khi input bắt đầu /)   │  ← SlashMenu
├──────────────────────────────────────────────┤
│ > nhập prompt...                            │  ← Prompt
│                                              │
│ Esc exit · / · Shift+Tab · Shift+Enter      │  ← Footer hints
└──────────────────────────────────────────────┘
```

### Component Tree
```
ChatApp
├── Header (sticky, top)
│   ├── Logo + version
│   ├── Provider + model
│   └── Status line (session, mode, cost, permission)
├── AgentStatus (collapsible, auto-hide khi idle)
├── MessageList (virtualized, scrollable)
│   └── MessageBubble per role
├── SlashMenu (conditional, khi input starts with "/")
├── Prompt (multi-line aware)
└── Footer (sticky, bottom)
    └── KeybindingHints
```

### State Management
- Không thêm thư viện state, dùng useState/useReducer có sẵn
- Thêm `useMultiLineInput` hook cho prompt
- Thêm `useFirstRun` hook detect chưa auth/config

## Related Code Files

### Create
- `src/cli/components/Footer.tsx` — keybinding hints bar
- `src/cli/components/WelcomeBanner.tsx` — first-run banner
- `src/cli/components/MessageBubble.tsx` — colored message với role icon
- `src/cli/hooks/useMultiLineInput.ts` — multi-line input logic
- `src/cli/hooks/useFirstRun.ts` — detect missing config/auth
- `src/cli/components/slash-palette.ts` — group slash commands theo category
- `src/cli/components/Footer.test.tsx`
- `src/cli/components/WelcomeBanner.test.tsx`
- `src/cli/hooks/useMultiLineInput.test.ts`
- `src/cli/hooks/useFirstRun.test.ts`
- `src/cli/components/slash-palette.test.ts`

### Modify
- `src/index.ts` — không cần đổi (đã mặc định mở TUI ở line 191-202)
- `src/cli/tui.tsx` — refactor layout, thêm Footer/WelcomeBanner
- `src/cli/components/Header.tsx` — sticky, gom status line
- `src/cli/components/MessageList.tsx` — dùng MessageBubble có màu
- `src/cli/components/AgentStatus.tsx` — màu sắc theo event type
- `src/cli/components/Prompt.tsx` — multi-line input qua hook
- `src/cli/components/SlashMenu.tsx` — gom nhóm + mô tả dài hơn
- `src/cli/slash-commands.ts` — thêm `category` field cho mỗi command
- `src/storage/auth-profiles.ts` — export `hasAnyActiveProfile()` helper

### Delete
- Không có

## Implementation Steps

### Step 1: Slash command metadata (30m)
1. Thêm `category: 'mode' | 'session' | 'debug' | 'info'` cho mỗi entry trong `SLASH_COMMANDS`
2. Group:
   - `mode`: /chat, /agent, /permission
   - `session`: /clear, /resume, /fork, /memory, /undo
   - `debug`: /context, /compact, /cost, /health, /models
   - `info`: /help, /version, /config, /model, /auth, /history, /init
3. Update `filterSlashCommands` sort theo category
4. Test: `slash-palette.test.ts`

### Step 2: Multi-line input hook (1h)
1. `useMultiLineInput` hook:
   - internal state: `lines: string[]`, `currentLine: string`
   - Enter → submit nếu `lines.length === 0` hoặc `currentLine === ''`, ngược lại nối vào lines
   - Shift+Enter → chèn `\n`, di chuyển `currentLine` xuống lines
   - ↑↓ trong multi-line → di chuyển giữa các line (optional, defer nếu phức tạp)
2. Wire vào `Prompt.tsx` thay cho `ink-text-input` khi multi-line
3. Test: `useMultiLineInput.test.ts`

### Step 3: Welcome banner (1h)
1. `WelcomeBanner` component:
   - Logo ASCII 3 dòng: `███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗`
   - Version + cwd
   - Auth status (openai/anthropic/google): ok/missing
   - First-run hint nếu missing
2. `useFirstRun` hook:
   - check `hasAnyActiveProfile()` + `config.aliases` rỗng
   - return `{ isFirstRun, missingProviders[] }`
3. **Auto-dismiss**: banner tự ẩn khi user submit prompt đầu tiên — KHÔNG cần explicit dismiss action, không block input
4. Test: `WelcomeBanner.test.tsx`, `useFirstRun.test.ts`

### Step 4: Status bar + Footer (1.5h)
1. `Header.tsx` refactor:
   - Top: Logo + version (1 dòng)
   - Middle: Provider + Model (1 dòng)
   - Bottom: Session ID · Mode · Permission · Cost (1 dòng, update realtime)
   - **Cost format**: sub-cent hiển thị `$0.0012` (4 chữ số), cent-level hiển thị `$1.23` (2 chữ số) — dùng helper `formatCost(usd)`
2. `Footer.tsx`:
   - 1 dòng keybinding hints, dim color
   - Hints: `Esc exit · / commands · Shift+Tab permission · Shift+Enter newline · ↑↓ history`
3. Wire vào `tui.tsx`
4. Test: `Footer.test.tsx`

### Step 5: MessageList + AgentStatus polish (1.5h)
1. `MessageBubble`:
   - User: cyan bold `You ▸`
   - Assistant: green `◆`
   - System: dim italic
   - Error: red `✗`
2. `MessageList`:
   - **Lazy trim**: chỉ render 50 message cuối + `[... N earlier messages hidden ...]` placeholder khi vượt quá — tránh lag với session dài
   - Margin giữa messages
   - Truncate content nếu quá dài (chừa lại 3 dòng cuối)
3. `AgentStatus`:
   - Color theo prefix: `>` yellow (tool_start), `+` green (ok), `✗` red (error), `🔒` magenta (permission), `💾` cyan (checkpoint)
   - Chỉ giữ 20 dòng cuối (rolling buffer) — tránh tràn terminal
4. Test: update `tui.test.ts` nếu có, hoặc snapshot test

### Step 6: TUI integration (2h)
1. Refactor `tui.tsx`:
   - State machine: `mode: 'welcome' | 'chat'`, transition khi submit đầu tiên
   - Sticky header + footer luôn render
   - WelcomeBanner chỉ render khi `mode === 'welcome'`
2. Khi `useFirstRun.missingProviders.length > 0` → show banner + block input cho đến khi user gõ `neuro auth` hoặc dismiss
3. Khi `!auth && missingProviders` → show inline status ở header: `⚠ no auth — run neuro auth`
4. Test: integration test cho ChatApp

### Step 7: Tests + verification (1.5h)
1. Chạy `npm test` → đảm bảo pass hết
2. Chạy `npm run typecheck && npm run lint` → clean
3. `npm run dev` → mở TUI, thử các flow:
   - First-run: banner hiện, hint rõ
   - Authed: header có provider/model, footer có hints
   - Shift+Enter: chèn newline
   - Slash palette: gom nhóm, scroll highlight
   - Streaming: message bubble update realtime
4. Test trên Windows Terminal + cmd

### Step 8: Docs (1h)
1. Update `README.md` — thêm section "Interactive TUI" với ASCII mockup
2. Thêm screenshot (text-based) trong `docs/screenshots/` nếu có
3. Update `docs/architecture.md` — note Phase 5

## Success Criteria
- [ ] `neuro` mở TUI polished trong < 2s
- [ ] Welcome banner xuất hiện khi chưa auth/config, **tự ẩn khi submit prompt đầu tiên** (không block)
- [ ] Header sticky với provider/model/session/cost/permission, cost format sub-cent 4 chữ số
- [ ] Footer sticky với keybinding hints
- [ ] Shift+Enter chèn newline; Enter submit
- [ ] Slash palette gom nhóm + highlight
- [ ] MessageList có màu sắc phân biệt role, **lazy trim về 50 message cuối**
- [ ] AgentStatus event có màu sắc, **rolling buffer 20 dòng**
- [ ] 221+ test pass, ESLint clean, typecheck clean
- [ ] Không tăng startup > 500ms
- [ ] README + docs cập nhật

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shift+Enter conflict terminal | Medium | Medium | Test trên Win Terminal + iTerm2; fallback Ctrl+Enter |
| Welcome banner quá dài | Low | Low | Compact design, max 8 dòng |
| Multi-line input vỡ single-line UX | Medium | High | Default Enter = submit; Shift+Enter explicit |
| Component refactor vỡ snapshot test | Medium | Low | Cập nhật snapshot; visual verify |
| Auth detection chậm | Low | Low | Cache kết quả `hasAnyActiveProfile` 1s |
| Ink render flicker khi streaming | Medium | Medium | Batch updates với `useReducer` + `React.memo` |

## Open Questions
- Có cần mouse support không? (Defer — out of scope theo user)
- Có cần syntax highlight cho code trong messages không? (Defer — phase 6+)
- Có nên dùng `ink-multi-select` cho slash palette không? (Defer — dùng component tự viết để giữ zero-deps)
