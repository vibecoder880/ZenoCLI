# Phase 12 — Responsive

**Status:** DONE
**Branch:** khanh

## Goal

Width-tier responsive behavior per `docs/ui/responsive.md`: Header and Statusline adapt content to terminal width (80/100/120/160/200 cols).

## Scope

### 1. Header width tiers
Update `src/ui/components/Header.tsx`:
- `< 80` (narrow): `ZENO · model · branch` — no cwd, no context
- `80–120` (medium): brand + model + branch + cwd
- `120–160` (wide): brand + cwd + model + branch + context %
- `> 160` (ultrawide): brand + cwd + branch + model · context

### 2. Statusline width tiers
Update `src/ui/components/Statusline.tsx`:
- `< 80` (narrow): hidden (already handled by `isCompact` in Shell)
- `80–120` (medium): model · branch
- `120–160` (wide): + context %
- `> 160` (ultrawide): + tokens · cost · duration · agents

### 3. Shell integration
Update `src/ui/app/Shell.tsx`:
- Pass `widthTier` to Header and Statusline
- Use `widthTier` to decide compact mode for Statusline

### 4. Tests
- `Header.test.tsx`: test each width tier shows correct sections
- `Statusline.test.tsx`: test compact vs wide modes
- Full `src/ui` green; `tsc` clean.

## Files to modify/create

| File | Action |
|------|--------|
| `src/ui/components/Header.tsx` | MODIFY — add widthTier prop, conditional sections |
| `src/ui/components/Header.test.tsx` | CREATE — width tier tests |
| `src/ui/components/Statusline.tsx` | MODIFY — ensure compact mode matches spec |
| `src/ui/app/Shell.tsx` | MODIFY — pass widthTier to children |

## Notes

- Width tiers are data-driven (no hard-coded pixel values).
- Header uses `compact` prop already; extend to use `widthTier` for finer control.
- Statusline `compact` prop already filters sections; verify it matches spec tiers.
- No new components needed — just prop additions and conditional rendering.
