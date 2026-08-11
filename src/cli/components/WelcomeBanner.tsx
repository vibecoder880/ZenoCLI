import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme.js";

const ASCII_LOGO = `███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗
████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗
██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║
██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║
██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝
╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝`;

export interface WelcomeBannerProps {
  version: string;
  cwd: string;
  providers: Array<{ slug: string; status: "ok" | "missing" }>;
  missingProviders: string[];
  onDismiss?: () => void;
}

export function WelcomeBanner({
  version,
  cwd,
  providers,
  missingProviders,
  onDismiss
}: WelcomeBannerProps): React.JSX.Element {
  const hasMissing = missingProviders.length > 0;
  const theme = useTheme();

  return (
    <Box
      borderStyle="round"
      borderColor={hasMissing ? theme.warning : theme.primary}
      paddingX={1}
      flexDirection="column"
      marginTop={1}
    >
      <Text color={theme.primary}>{ASCII_LOGO}</Text>
      <Box marginTop={1}>
        <Text dimColor>v{version} · </Text>
        <Text color={theme.success}>{cwd}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Providers</Text>
        {providers.map((provider) => (
          <Text key={provider.slug} color={provider.status === "ok" ? theme.success : "red"}>
            {provider.status === "ok" ? "✓" : "✗"} {provider.slug}
            {provider.status === "ok" ? " (authenticated)" : " (no auth)"}
          </Text>
        ))}
      </Box>

      {hasMissing ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.warning}>⚠ Missing auth for: {missingProviders.join(", ")}</Text>
          <Text dimColor>Run: zeno auth {missingProviders[0]}</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>
          Type a prompt to begin. Try /help for commands. Banner dismisses on first prompt.
        </Text>
      </Box>

      {onDismiss ? (
        <Box marginTop={1}>
          <Text dimColor>(press Esc to dismiss)</Text>
        </Box>
      ) : null}
    </Box>
  );
}
