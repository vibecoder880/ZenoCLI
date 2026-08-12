# Zeno UI v2 — Interaction Model

Single-screen, conversation-first. There is **no dashboard**, **no tab bar**, **no sidebar**. Focus changes only shift *content*, never layout. See `component-spec.md` for the component shapes.

## One main screen

```
ZENO                                           Sonnet 5 · main · 18%
~/Projects/ZenoCLI

› Fix the authentication bug and add tests.

I'll trace the authentication flow first.

  ✓ src/auth.ts
  ✓ src/token.ts
  ✓ 8 references

Implementing the fix…

  M src/auth.ts
  M src/token.ts

Running tests…
  48 passed · 1 failed

The failing test reproduces the original bug. I'll fix that before finishing.

›
```

Base layout (top→bottom): `Header` / `Conversation` / `Input` / `Statusline`. Overlays float above the input area.

## Focus modes (views, not layouts)

- **Chat** (default): the conversation.
- **Focus views** (`/task`, `/review`, `/diff`, `/agents`): the *conversation area* is replaced by the view content until `/clearview` or `Esc`. Nothing else changes — no tabs, no panels.
  - `Ctrl+T` task view · `Ctrl+A` agents · `Ctrl+D` diff.

## The three "quiet" rules

1. **Toggleable detail** — every block has a collapsed summary; `Enter`/`→` expands one level.
2. **No raw tool logs** — tool activity renders as an operational line (`Reading 4 files…`), never `Tool: grep` + args + result blob.
3. **No chain-of-thought** — only operational status (`Inspecting repository…`, `Locating auth flow…`).

## Input

- Idle: `›`
- Placeholder: `› What would you like to build?`
- Autocomplete appears *under* the line.
- `Enter` submits; `Shift+Enter` newline.

## Clipboard-backed transcript

Long sessions do not re-render fully. The transcript is virtualized: viewport + buffer; windowing keeps typing latency < 16 ms.

## Keyboard model

See `keyboard.md` for the canonical keymap. Summary:

- `Enter` submit / expand focused block
- `Shift+Enter` newline (in composer)
- `Tab` autocomplete / next suggestion
- `Up`/`Down` move through slash/autocomplete suggestions
- `Ctrl+P` command palette
- `Ctrl+T` / `Ctrl+A` / `Ctrl+D` focus task / agents / diff views
- `Esc` interrupt running work, dismiss overlay, or return to chat
- `Ctrl+C` (not busy) interrupt streaming; (busy) send interrupt marker

## Progressive disclosure examples

1. `✓ Running tests` → `Enter` → `npm test · 48 passed · 1 failed · tests/auth.test.ts` → `Enter` → full stderr diff.
2. Assistant checkmarks: `✓ Read 4 files` → `Enter` → `src/auth.ts · src/token.ts · src/oauth.ts · tests/auth.test.ts`.
3. Review item: `HIGH src/auth.ts:84` → `f` fix / `r` review again / `Enter` inspect.

## Permission prompt

In-line, not a modal covering the screen:

```
Zeno wants to run:
  npm install
Directory:
  ~/Projects/ZenoCLI
Risk: low

Enter  Allow · a  Always allow · d  Deny · e  Edit policy
```

## Focus views

`/diff`:

```
Changed files

src/auth.ts
src/token.ts
tests/auth.test.ts

3 files changed · +42 -11
```

`/review`:

```
Review

3 issues found

  HIGH  src/auth.ts:84  Token audience is not validated.
  MED  src/db.ts:31     Connection recreated per request.
  LOW  tests/auth.test.ts:12  Missing invalid-token case.
```

Selecting an item shows its detail in-place, not in a box.

## Overlays (transient, small)

Command palette, model picker, theme picker, permission, session picker, help, file picker all share **one** overlay system (`overlay-layer`). An overlay:

- floats above the input area,
- never covers the full screen (except file picker detail which may),
- has an optional subtle dim behind it,
- closes on `Esc` or on selection.

Example model picker:

```
Model

› Sonnet 5
  GPT-5.6
  Gemini 3
```