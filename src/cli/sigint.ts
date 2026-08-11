/**
 * Shared SIGINT → AbortController helper for CLI commands.
 * Used by headless/pipe commands so Ctrl+C cancels an in-flight request
 * cleanly instead of killing the process mid-stream.
 */
export function installSigintAbort(): AbortSignal {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  return controller.signal;
}
