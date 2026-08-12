/**
 * Zeno UI v2 — public surface for the renderer foundation (Phase 1).
 *
 * Convenience re-exports so consumers can import from `../ui/index.js`
 * instead of deep paths. Deep imports remain available.
 */

export {
  ZENO_DARK_TOKENS,
  ZENO_LIGHT_TOKENS,
  SPACING,
  BORDER,
  RADIUS,
  SYSTEM_TOKEN,
  type ZenoTokens,
} from "./theme/tokens.js";
export {
  resolveTheme,
  themeSourceFrom,
  type ThemeConfig,
  type ThemeMode,
  type ThemeName,
  type ThemeSource,
} from "./theme/engine.js";
export {
  detectCapabilities,
  detectColorLevel,
  detectDimensions,
  detectNativeBackground,
  detectOsc8,
  detectUnicode,
  isNoColor,
  type ColorLevel,
  type TerminalCapabilities,
} from "./terminal/system.js";
export {
  ResizeObserver,
  widthTier,
  isCompact,
  type Viewport,
  type WidthTier,
} from "./terminal/resize.js";
export {
  resolveSymbols,
  ascii,
  UNICODE_SYMBOLS,
  ASCII_SYMBOLS,
  type SymbolMap,
} from "./render/markdown.js";
export { thinkingFrame, ANIMATION_FRAME_MS, type AnimationState } from "./render/animation.js";
export {
  KeyboardManager,
  type Focus,
} from "./keyboard/manager.js";
export {
  resolveAction,
  scopeOf,
  DEFAULT_SCOPE,
  type InkKey,
  type KeyAction,
  type KeyScope,
  type KeySpec,
} from "./keyboard/bindings.js";
export {
  OverlayManager,
  initialUIState,
  type OverlayKind,
  type OverlayState,
  type UIState,
} from "./state/overlay-manager.js";