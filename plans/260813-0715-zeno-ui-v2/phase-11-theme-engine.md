# Phase 11 — Theme Engine

**Status:** IN PROGRESS
**Branch:** khanh

## Goal

Full theme support per `docs/ui/theme.md`: custom themes from `.zeno/themes/*.json`, built-in theme JSON files, theme config plumbing, and `/theme` picker overlay.

## Scope

### 1. Built-in theme JSON files
Create `src/ui/theme/themes/` with JSON files for each named theme:
- `zeno-dark.json`, `zeno-light.json`, `tokyo.json`, `nord.json`, `dracula.json`
- Format: `{ "name": "...", "base": "dark"|"light", "colors": { ...ZenoTokens } }`
- These become the single source of truth; engine.ts `themedTokens()` reads from them.

### 2. Custom theme loader
New `src/ui/theme/custom-themes.ts`:
- Scans `~/.zeno/themes/*.json` for user-defined themes
- Validates JSON schema (name, base, colors with required token keys)
- Returns `ThemeName[]` of discovered custom themes
- Graceful fallback: missing dir → empty list; malformed JSON → skip with warning

### 3. Theme engine update
Update `src/ui/theme/engine.ts`:
- `themedTokens()` loads from built-in JSON + custom themes
- New `listThemes()` function: returns all available themes (built-in + custom)
- `ThemeName` type extended to include custom theme names (string union widened)

### 4. Theme barrel
Create `src/ui/theme/index.ts`:
- Re-export public API: `resolveTheme`, `listThemes`, `ZenoTokens`, etc.

### 5. Theme config plumbing
Update `src/ui/app/Shell.tsx`:
- Read `config.toml` `[theme]` section → `ThemeConfig`
- Pass to `UiThemeProvider`

### 6. `/theme` picker overlay
- Add keyboard binding for `/theme` (or Cmd+T equivalent)
- On trigger: open overlay with all available themes, highlight current
- Selection → update theme config, re-render

### 7. Tests
- `engine.test.ts`: test custom theme loading, `listThemes()`, invalid JSON handling
- `custom-themes.test.ts`: test JSON validation, directory scanning
- Full `src/ui` green; `tsc` clean.

## Files to modify/create

| File | Action |
|------|--------|
| `src/ui/theme/themes/*.json` | CREATE — 5 built-in theme files |
| `src/ui/theme/custom-themes.ts` | CREATE — JSON loader + validator |
| `src/ui/theme/custom-themes.test.ts` | CREATE — tests |
| `src/ui/theme/engine.ts` | MODIFY — load from JSON, add `listThemes()` |
| `src/ui/theme/engine.test.ts` | MODIFY — add custom theme tests |
| `src/ui/theme/index.ts` | CREATE — barrel exports |
| `src/ui/app/Shell.tsx` | MODIFY — theme config plumbing |
| Keyboard bindings | MODIFY — add `/theme` action |

## Notes

- Keep backward compat: existing `resolveTheme()` API unchanged, just extended.
- Custom themes are additive; built-in themes always available.
- Theme picker is a simple list overlay (no preview swatches in v1).
- JSON validation is lenient: missing optional fields get defaults from base theme.
