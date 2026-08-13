import React from "react";
import { Box, Text } from "ink";
import { createRequire } from "node:module";
import { useTheme } from "../theme.js";

const require = createRequire(import.meta.url);
const pkg = require("../../../package.json") as { version: string };
const VERSION: string = pkg.version;

const ASCII_LOGO = `██╗   ██╗███████╗███╗   ██╗ ██████╗
██║   ██║██╔════╝████╗  ██║██╔═══██╗
██║   ██║█████╗  ██╔██╗ ██║██║   ██║
╚██╗ ██╔╝██╔══╝  ██║╚██╗██║██║   ██║
 ╚████╔╝ ███████╗██║ ╚████║╚██████╔╝
  ╚═══╝  ╚══════╝╚═╝  ╚═══╝ ╚═════╝`;

export interface WelcomeBannerProps {
  version?: string;
  cwd: string;
  providers: Array<{ slug: string; status: "ok" | "missing" }>;
  missingProviders: string[];
  onDismiss?: () => void;
}

export function WelcomeBanner({
  version = VERSION,
  cwd,
  providers,
  missingProviders,
  onDismiss
}: WelcomeBannerProps): React.JSX.Element {
  const hasMissing = missingProviders.length > 0;
  const theme = useTheme();

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box justifyContent="center">
        <Text color={theme.primary}>{ASCII_LOGO}</Text>
      </Box>
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>v{version} · </Text>
        <Text color={theme.success}>{cwd}</Text>
      </Box>

      <Box justifyContent="center" marginTop={1} flexDirection="column">
        <Box justifyContent="center">
          <Text bold>Providers</Text>
        </Box>
        {providers.map((provider) => (
          <Box key={provider.slug} justifyContent="center">
            <Text color={provider.status === "ok" ? theme.success : "red"}>
              {provider.status === "ok" ? "✓" : "✗"} {provider.slug}
              {provider.status === "ok" ? " (authenticated)" : " (no auth)"}
            </Text>
          </Box>
        ))}
      </Box>

      {hasMissing ? (
        <Box justifyContent="center" marginTop={1} flexDirection="column">
          <Box justifyContent="center">
            <Text color={theme.warning}>⚠ Missing auth for: {missingProviders.join(", ")}</Text>
          </Box>
          <Box justifyContent="center">
            <Text dimColor>Run: zeno auth {missingProviders[0]}</Text>
          </Box>
        </Box>
      ) : null}

      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>
          Type a prompt to begin. Try /help for commands. Banner dismisses on first prompt.
        </Text>
      </Box>

      {onDismiss ? (
        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>(press Esc to dismiss)</Text>
        </Box>
      ) : null}
    </Box>
  );
}
