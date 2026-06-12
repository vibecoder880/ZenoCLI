---
title: "Phase 5 — TUI Parity với Claude Code"
status: planning
created: 2026-06-13
scope: project
phases: [phase-5-tui-parity]
---

# NeuroCli → Phase 5: TUI Parity với Claude Code

## Overview
Biến `neuro` (no subcommand) thành entrypoint mặc định mở giao diện TUI polished giống Claude Code:
welcome banner, sticky status bar, footer với keybinding hints, slash command palette,
và multi-line input. Không phá vỡ các subcommand hiện có.

## Scope (đã chốt với user)

**In scope:**
- Welcome screen với logo ASCII + model + session info + first-run hints
- Sticky status bar (mode · session · cost · permission · provider/model)
- Footer hint bar (Esc, /, Shift+Tab, ↑↓, Enter, Shift+Enter)
- Multi-line input (Shift+Enter chèn newline, Enter vẫn submit)
- Slash command palette UX polish (description, grouping, recent commands)
- Cải thiện MessageList: phân biệt user/assistant/system với màu sắc + scroll indicator
- Cải thiện AgentStatus: stream event log realtime có màu
- First-run detection (chưa có config hoặc chưa auth) → hiển thị banner hướng dẫn `neuro auth`
- Default behavior: nếu chưa có config/auth → mở TUI với banner hướng dẫn thay vì crash
- Đảm bảo `neuro` (no args) vẫn mở TUI như trước (đã có sẵn ở src/index.ts:191-202)

**Out of scope (YAGNI — user đã bỏ chọn):**
- Sidebar / split-pane
- Scrollback history lên xuống
- LSP diagnostics trong TUI
- Mouse support

## Phases

| # | Name | Effort | Priority | Status |
|---|------|--------|----------|--------|
| 1 | Slash command metadata + category | 30m | P1 | completed |
| 2 | Multi-line input hook (Shift+Enter) | 1h | P1 | completed |
| 3 | WelcomeBanner + useFirstRun hook | 1h | P1 | completed |
| 4 | Sticky Header + Footer keybinding hints | 1.5h | P1 | completed |
| 5 | MessageBubble + AgentStatus event color | 1.5h | P2 | completed |
| 6 | TUI integration (state machine welcome → chat) | 2h | P1 | completed |
| 7 | Tests + visual verification | 1.5h | P1 | completed |
| 8 | Docs update (README + architecture) | 1h | P2 | completed |

**Total: ~9.5h**

## Non-Negotiable Constraints
- Tất cả 3 providers (OpenAI, Anthropic, Google) vẫn phải chạy
- ESM-only, Node >= 22, TypeScript strict
- Tất cả 221+ test hiện tại phải pass
- Không breaking CLI: `neuro chat`, `neuro agent`, `neuro auth`... vẫn hoạt động
- Không thêm dependency mới nếu có thể dùng ink đã có

## Phase Files
- [Phase 5: TUI Parity](./phase-5-tui-parity.md)

## Dependencies
- Phase 1-4 đã complete (theo plan.md progress)

## Cross-Plan Impact
- Không xung đột với phase 1-4 (đã complete).
- Tái sử dụng: `src/cli/tui.tsx`, `src/cli/components/*`, `src/storage/auth-profiles.ts`, `src/storage/config.ts`, `src/cli/slash-commands.ts`.

## Success Criteria
- [x] `neuro` (no args) mở TUI polished trong < 2s
- [x] Welcome banner hiện model + session ID + provider status
- [x] Nếu chưa auth → banner hướng dẫn chạy `neuro auth <provider>`
- [x] Footer hiển thị rõ keybinding hints
- [x] Status bar sticky ở trên cùng, update realtime khi cost/mode đổi
- [x] Shift+Enter chèn newline, Enter submit (giống Claude Code)
- [x] Slash palette có scroll highlight, group theo category (mode, session, debug)
- [x] MessageList có màu riêng cho user (cyan) / assistant (green) / system (dim)
- [x] Tất cả test pass, ESLint clean, typecheck clean
- [x] Không tăng thời gian startup > 500ms

## Implementation Status
- [x] **Hoàn thành** — Phase 5 đã implement và verify (238 tests pass, ESLint clean, build clean).

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Shift+Enter có thể conflict với terminal emulator | Test trên Windows Terminal, iTerm2, VSCode terminal; fallback Ctrl+Enter |
| Welcome screen quá dài gây trải nghiệm xấu | Compact, < 8 dòng, chỉ hiện first-run |
| Multi-line input làm vỡ UX người dùng quen single-line | Mặc định Enter vẫn submit; Shift+Enter explicit |
| Thay đổi component layout làm vỡ snapshot test | Cập nhật snapshot; chạy visual verify bằng ink-testing-library nếu có |
