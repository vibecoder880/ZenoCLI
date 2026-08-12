# Zeno UI v2 — Keyboard

Single, global keymap. No mode-specific binds that hide basic navigation.

## Global keys

| Key | Context | Action |
| --- | --- | --- |
| `Enter` | input | submit prompt |
| `Enter` | focused block | expand/collapse detail one level |
| `Shift+Enter` | input (multi-line) | insert newline |
| `Esc` | running | interrupt current work (sets interrupt marker) |
| `Esc` | blocked input | cancel/close (welcome, overlay, open dialog) |
| `Esc` | idle | nothing (never exits by accident) |
| `Ctrl+C` | busy | send interrupt marker |
| `Ctrl+C` | idle | (terminal-level) exit |
| `Tab` | autocomplete visible | accept highlighted suggestion |
| `Up` / `Down` | suggestion list | move selection |
| `Up` / `Down` | input (empty) | previous/next history entry |

## Commands

| Key | Action |
| --- | --- |
| `Ctrl+P` | command palette |
| `Ctrl+T` | focus task view (`/tasks`) |
| `Ctrl+A` | focus agents view (`/agents`) |
| `Ctrl+D` | focus diff view (`/diff`) |
| `Shift+Tab` | cycle permission mode (default → acceptEdits → …) |

Any focus view (`Ctrl+T`/`Ctrl+A`/`Ctrl+D`) returns to chat with `Esc` or `/clearview`.

## Slash command palette

Typing `/` shows the family under the input line (no menu box):

```
/
  help   model   review   diff   tasks   agents
  memory session theme    config exit
```

`Up`/`Down` move selection, `Tab` completes, `Enter` runs, `Esc` closes.

## Model picker

`/model` or `Ctrl+P → model`:

```
Model

› Sonnet 5
  GPT-5.6
  Gemini 3
```

`Up`/`Down` move · `Enter` selects · `Esc` closes.

## Composer

`/` the command family · `@file` file suggestions · `!cmd` shell shortcut.

| Key | Action |
| --- | --- |
| `Enter` | submit |
| `Shift+Enter` | newline |
| `Esc` | abort this input / close autocomplete |
| `Tab` | accept first suggestion |
| `Ctrl+P` | open command palette (over input) |

Full composer spec lands in Phase 4 (`keyboard.md` then references `composer.md`).

## Keyboard manager

Single `KeyboardManager` owns all bindings (Phase 1 foundation):

- `bindings.ts` — the table above, data-driven (key → action) so `NO_COLOR`/`--no-color` never re-binds keys.
- `manager.ts` — resolve key events to actions, dispatch, and expose an event so the TUI reflects focus state (busy / input / overlay / view).
- Interrupt is a *state*, not a key: running work polls `KeyboardManager.interruptRequested()`.

## Accessibility

- Every action has a keyboard path; mouse is optional and never required.
- `Esc` out of every overlay; no key sequence is a trap.