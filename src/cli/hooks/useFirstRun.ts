import { useMemo } from "react";
import { hasAnyActiveProfile, listMissingProviders } from "../../auth/auth-profiles.js";
import type { NeuroConfig } from "../../storage/config.js";

export interface FirstRunState {
  isFirstRun: boolean;
  missingProviders: string[];
  hasAnyProvider: boolean;
}

export function detectFirstRun(config: NeuroConfig): FirstRunState {
  const missing = listMissingProviders();
  const hasAny = hasAnyActiveProfile();
  const isFirstRun = !hasAny || Object.keys(config.aliases ?? {}).length === 0;

  return {
    isFirstRun,
    missingProviders: missing,
    hasAnyProvider: hasAny
  };
}

export function useFirstRun(config: NeuroConfig): FirstRunState {
  return useMemo(() => detectFirstRun(config), [config]);
}
