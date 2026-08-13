# Phase 3 — Conversation engine

**Status:** DONE (CI verify pending)
**Branch:** khanh

## Goal

Upgrade the v2 Conversation from plain-text rendering to a Markdown-aware,
streaming, collapsible transcript with quiet tool lines and transcript
virtualization — per spec §5, §26-29 and `docs/ui/component-spec.md`
§ Message blocks.

## Scope

Renderer (pure, no React):
- **`src/ui/render/markdown-parse.ts`** — lightweight block + inline parser:
  headings, paragraphs, bullet/ordered lists, fenced + indented code, quotes,
  rules, tables, links, and unified-diff detection. No external dependency.

Block renderer (Ink):
- **`src/ui/render/markdown-blocks.tsx`** — `MarkdownBlock` maps parsed blocks
  to theme-token Ink elements: bold/italic/code/link inline, muted-indented code,
  color-coded diffs (`+`/`-`/`@@`), padded tables, `│` quotes, `·` bullets,
  numbered lists, `─────` rules. OSC 8 links degrade to `text (url)`.

Conversation (`src/ui/components/Conversation.tsx`):
- `ChatLine` extended with `streaming?`, `collapsed?`, `summary?` fields and a
  new `tool` role.
- `AssistantMessage` renders parsed Markdown, shows a streaming cursor (`▍`/`|`),
  and collapses to a one-line `→ summary` (progressive disclosure).
- `ToolLine` renders quiet operational lines (muted; warning for error-marked).
- `Conversation` accepts `osc8` and caps visible messages with a hidden-count
  marker (`maxVisible`).

Wiring:
- **`src/ui/app/Shell.tsx`** — passes `osc8={caps.osc8Links}` from detected
  capabilities into `Conversation`.

## Tests

New: `markdown-parse.test.ts` (13), `markdown-blocks.test.tsx` (9),
`Conversation.test.tsx` (8). Renderer/Conversation tests pass; full `src/ui`
suite green; `tsc` + `eslint` clean.

## Notes / Deviations

- Markdown support is intentionally a narrow hand-rolled parser (per KISS/YAGNI
  and no new dependency) rather than a full CommonMark engine. It covers the
  shapes common in assistant output; exotic constructs fall back to plain text.
- `tool` role + `collapsed`/`streaming` fields are the seams Phase 5
  (Action/Activity) and Phase 6 (Task) build on; they render but the TUI does
  not yet emit them.
