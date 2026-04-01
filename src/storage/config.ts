import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as toml from "@iarna/toml";
import { ensureAppDataDirectory } from "./paths.js";

export interface NeuroConfig {
  default: {
    model: string;
    provider: string;
    streaming: boolean;
  };
  aliases: Record<string, string>;
  context: {
    maxTokens: number;
    ignore: string[];
  };
}

export const DEFAULT_CONFIG: NeuroConfig = {
  default: {
    model: "openai/gpt-4.1-mini",
    provider: "openai",
    streaming: true
  },
  aliases: {
    fast: "openai/gpt-4.1-mini",
    smart: "anthropic/claude-sonnet-4-0",
    cheap: "google/gemini-2.5-flash"
  },
  context: {
    maxTokens: 100_000,
    ignore: ["node_modules", ".git", "dist"]
  }
};

function getConfigPath(): string {
  return path.join(ensureAppDataDirectory(), "config.toml");
}

function mergeConfig(partial: Partial<NeuroConfig> | undefined): NeuroConfig {
  return {
    default: {
      ...DEFAULT_CONFIG.default,
      ...(partial?.default ?? {})
    },
    aliases: {
      ...DEFAULT_CONFIG.aliases,
      ...(partial?.aliases ?? {})
    },
    context: {
      ...DEFAULT_CONFIG.context,
      ...(partial?.context ?? {})
    }
  };
}

export function loadConfig(): NeuroConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  const raw = readFileSync(configPath, "utf8");
  const parsed = toml.parse(raw) as Partial<NeuroConfig>;
  return mergeConfig(parsed);
}

export function saveConfig(config: NeuroConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, toml.stringify(config as unknown as toml.JsonMap), "utf8");
}

export function getConfigPathname(): string {
  return getConfigPath();
}

export function updateConfig(mutator: (config: NeuroConfig) => NeuroConfig): NeuroConfig {
  const current = loadConfig();
  const next = mutator(current);
  saveConfig(next);
  return next;
}
