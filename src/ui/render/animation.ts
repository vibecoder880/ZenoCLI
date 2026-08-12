/**
 * Zeno UI v2 — animation (spec §22, docs/ui/principles.md § Animation).
 *
 * Very light animation. A streaming/thinking line renders a single cycling
 * glyph (`.` `..` `...`) resolved from a tick counter — no long-running
 * animation, no full-screen redraw. Every animation resolves to a static
 * symbol (`✓`/`×`) as soon as the phase completes.
 */

/** Cycling frames for the thinking/working glyph. */
export const THINKING_FRAMES = ["", ".", "..", "..."] as const;

/** Pick the current frame given a tick. */
export function thinkingFrame(tick: number): (typeof THINKING_FRAMES)[number] {
  return THINKING_FRAMES[tick % THINKING_FRAMES.length];
}

export type AnimationState = "idle" | "running" | "success" | "error";

/** Terminal-safe minimum interval between animation frames (ms). */
export const ANIMATION_FRAME_MS = 120;