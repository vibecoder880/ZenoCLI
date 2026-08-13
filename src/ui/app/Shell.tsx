/**
 * Zeno UI v2 — App Shell (spec §3, §31, docs/ui/component-spec.md).
 *
 * Top-level v2 layout: Header / Conversation / Input / Statusline, wrapped in
 * the v2 theme provider with detected terminal capabilities. This is the shell
 * Phase 2 delivers; Phase 3+ fill Conversation and add the OverlayLayer.
 *
 * The shell is presentation-only: it receives `messages`/`input` as props and
 * emits `onSubmit`/`onChange`. Agent logic never renders UI (spec §28).
 */

import React, { useMemo } from "react";
import { Box } from "ink";
import { UiThemeProvider } from "../theme/provider.js";
import { detectCapabilities, type TerminalCapabilities } from "../terminal/system.js";
import { isCompact } from "../terminal/resize.js";
import { Header } from "../components/Header.js";
import { Conversation, Greeting, type ChatLine } from "../components/Conversation.js";
import { Composer } from "../components/Composer.js";
import { Statusline, type StatusSection } from "../components/Statusline.js";
import { KeyboardManager, type Focus } from "../keyboard/manager.js";
import { OverlayLayer } from "../components/OverlayLayer.js";
import type { OverlayState } from "../state/overlay-manager.js";
import type { ThemeConfig } from "../theme/engine.js";

export interface ShellProps {
  version: string;
  provider: string;
  model: string;
  branch: string;
  cwd: string;
  contextPct: number;
  messages: ChatLine[];
  input: string;
  /** Busy state disables the input and shows the thinking status. */
  busy: boolean;
  /** First-run shows the minimal greeting instead of the empty conversation. */
  firstRun: boolean;
  providersReady: number;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** Custom capability snapshot for tests; defaults to the live terminal. */
  capabilities?: TerminalCapabilities;
  keyboard?: KeyboardManager;
  /** Active overlay (Phase 8) rendered above the conversation. */
  overlay?: OverlayState | null;
  /** Theme configuration from config.toml. */
  themeConfig?: ThemeConfig;
}

export function Shell({
  version,
  provider,
  model,
  branch,
  cwd,
  contextPct,
  messages,
  input,
  busy,
  firstRun,
  providersReady,
  onInputChange,
  onSubmit,
  capabilities,
  keyboard,
  overlay,
  themeConfig,
}: ShellProps): React.JSX.Element {
  const caps = capabilities ?? detectCapabilities();

  const focus: Focus = busy ? "busy" : "input";
  if (keyboard) {
    keyboard.setFocus(focus);
  }

  const compact = isCompact(caps.columns);
  const unicode = caps.unicode;

  const statusSections = useMemo<StatusSection[]>(() => {
    const sections: StatusSection[] = [];
    if (branch) {
      sections.push({ key: "branch", text: branch });
    }
    sections.push({ key: "model", text: model, emphasis: "accent" });
    sections.push({ key: "context", text: `${contextPct}%` });
    if (!compact) {
      sections.push({ key: "tokens", text: `${messages.length} msgs` });
    }
    return sections;
  }, [branch, model, contextPct, compact, messages.length]);

  return (
    <UiThemeProvider
      config={themeConfig}
      source={{ colorLevel: caps.colorLevel, nativeBackground: caps.nativeBackground }}
      noColor={caps.noColor}
    >
      <Box flexDirection="column">
        <Header
          version={version}
          provider={provider}
          model={model}
          branch={branch}
          cwd={cwd}
          contextPct={contextPct}
          status={busy ? "thinking" : "idle"}
          compact={compact}
        />
        {firstRun ? (
          <Greeting version={version} cwd={cwd} providerCount={providersReady} />
        ) : (
          <Conversation messages={messages} unicode={unicode} osc8={caps.osc8Links} />
        )}
        <Composer
          value={input}
          placeholder={busy ? "Working… (Esc to interrupt)" : "What would you like to build?"}
          disabled={busy}
          unicode={unicode}
          cwd={cwd}
          onChange={onInputChange}
          onSubmit={onSubmit}
        />
        {overlay ? <OverlayLayer overlay={overlay} unicode={unicode} /> : null}
        {!compact ? <Statusline sections={statusSections} /> : null}
      </Box>
    </UiThemeProvider>
  );
}