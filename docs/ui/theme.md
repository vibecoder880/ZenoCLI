# Zeno UI v2 — Theme Engine

Design-token system + theme engine. No hard-coded `color="green"` anywhere.

## Design tokens

### Spacing
```
xs = 1   (adjacent glyphs)
sm = 2   (list indent, nested block)
md = 4   (block gap)
lg = 8   (section gap)
```
Indentation is the primary hierarchy signal; colors are secondary.

### Radius & border
- `radius = none`
- `border = none` by default

### Typography
| Token | Use |
| --- | --- |
| `normal` | body text |
| `strong` | bold labels, active task, headings |
| `title` | app wordmark, view headings |
| `mono` | file paths, code, ids, commands |

### Colors
| Token | Default (dark) | Default (light) | Role |
| --- | --- | --- | --- |
| `text` | terminal fg | terminal fg | body |
| `muted` | gray | gray | metadata |
| `subtle` | darkest gray | mid gray | hints, placeholders |
| `accent` | soft purple | deep purple | brand, active, highlights |
| `success` | soft green | soft green | ✓ |
| `warning` | warm yellow | amber | ! |
| `error` | soft red | soft red | × |

## Theme config (`config.toml`)

```toml
[theme]
mode = "system"        # system | dark | light | named
name = "zeno-dark"     # when mode = named: zeno-dark | zeno-light | tokyo | nord | dracula

[theme.palette]        # optional overrides of any token above
accent = "#7c6df2"
error  = "#ff5c5c"
```

Custom themes also load from `.zeno/themes/*.json`:

```json
{ "name": "nord", "base": "dark",
  "colors": { "text": "#d8dee9", "accent": "#88c0d0", "success": "#a3be8c",
              "warning": "#ebcb8b", "error": "#bf616a", "muted": "#4c566a", "subtle": "#434c5e" } }
```

## `${system}` (native) theme

Default. Uses the terminal's own palette (OpenCode direction):
- Zeno reads the terminal's foreground/background via capability detection.
- If unavailable, falls back to Zeno Dark.
- Background is never overridden by Zeno.

## Color level & fallback

| Terminal | Behavior |
| --- | --- |
| truecolor | full theme `#hex` rendered |
| 256-color | nearest-256 approximation |
| 16-color | bold for `accent`, standard ANSI for the rest |
| `NO_COLOR=1` / `--no-color` | no ANSI escape; symbols (`✓ × ! ● ○`) alone carry state |
| grayscale | hierarchy from weight/spacing/symbols — still usable |

Zeno must not rely on color for meaning: `× Error`, `✓ Success` are always printed.

## Theme engine API (Phase 1)

```
src/ui/theme/
  engine.ts    — resolve(palette | name | system | .zeno/themes) → resolved tokens
  tokens.ts    — ZenoTokens type + spacing/radius/typography constants
  system.ts    — detect terminal palette + color level, expose {level, background}
  themes/      — zeno-dark | zeno-light | tokyo | nord | dracula JSON
```

`useTheme()` returns resolved tokens keyed by semantic name. Components never name raw Ink colors.

## Phases

- **Phase 1**: engine + tokens + `system` detection (truecolor / 256 / NO_COLOR) + `zeno-dark` default.
- **Phase 11**: full theme list (`zeno-light`, `tokyo`, `nord`, `dracula`), `.zeno/themes/*.json` loading, `/theme` picker.