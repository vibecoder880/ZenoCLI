import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as toml from "@iarna/toml";
import { ensureAppDataDirectory } from "./paths.js";

export interface ZenoConfig {
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
  permission?: {
    /** Default permission mode. */
    mode?: "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions";
    /** Per-tool auto-approve rules. */
    autoApprove?: Record<string, boolean>;
  };
  /** Optional additional providers beyond the built-in set (config-driven registry). */
  providers?: Record<string, {
    /** Display name. */
    name: string;
    /** Auth methods the provider supports. */
    authMethods?: Array<"oauth" | "api_key" | "local">;
    /** Env var holding the API key. */
    envKey?: string;
  }>;
  /** Model routing strategy for `model: auto`. */
  routing?: {
    /** cost | quality | speed | balanced (default: balanced). */
    strategy?: "cost" | "quality" | "speed" | "balanced";
  };
  /** Spend budget with optional limits and auto-downgrade. */
  budget?: {
    /** Daily spend limit in USD (0 = unlimited). */
    dailyLimitUsd?: number;
    /** Monthly spend limit in USD (0 = unlimited). */
    monthlyLimitUsd?: number;
    /** Alert threshold as a fraction of budget (0-1). Default 0.8. */
    alertThreshold?: number;
    /** Downgrade routing to cost when budget is nearly used. Default true. */
    autoDowngrade?: boolean;
  };
  mcp?: {
    servers: Record<string, {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
  hooks?: {
    PreToolUse?: Array<{ match?: string; command?: string; prompt?: string }>;
    PostToolUse?: Array<{ match?: string; command?: string; prompt?: string }>;
    SessionStart?: Array<{ command?: string; prompt?: string }>;
    SessionEnd?: Array<{ command?: string; prompt?: string }>;
    Notification?: Array<{ command?: string; prompt?: string }>;
  };
}

export const DEFAULT_CONFIG: ZenoConfig = {
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
  },
  permission: {
    mode: "default",
    autoApprove: {}
  },
  mcp: {
    servers: {}
  },
  hooks: {
    PreToolUse: [],
    PostToolUse: []
  },
  providers: {},
  routing: {
    strategy: "balanced"
  },
  budget: {
    dailyLimitUsd: 0,
    monthlyLimitUsd: 0,
    alertThreshold: 0.8,
    autoDowngrade: true
  }
};

function getConfigPath(): string {
  return path.join(ensureAppDataDirectory(), "config.toml");
}

function mergeConfig(partial: Partial<ZenoConfig> | undefined): ZenoConfig {
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
    },
    permission: {
      ...DEFAULT_CONFIG.permission,
      ...(partial?.permission ?? {}),
      autoApprove: {
        ...(DEFAULT_CONFIG.permission?.autoApprove ?? {}),
        ...(partial?.permission?.autoApprove ?? {})
      }
    },
    mcp: {
      ...DEFAULT_CONFIG.mcp,
      ...(partial?.mcp ?? {}),
      servers: {
        ...(DEFAULT_CONFIG.mcp?.servers ?? {}),
        ...(partial?.mcp?.servers ?? {})
      }
    },
    hooks: {
      ...DEFAULT_CONFIG.hooks,
      ...(partial?.hooks ?? {}),
      PreToolUse: [
        ...(DEFAULT_CONFIG.hooks?.PreToolUse ?? []),
        ...(partial?.hooks?.PreToolUse ?? [])
      ],
      PostToolUse: [
        ...(DEFAULT_CONFIG.hooks?.PostToolUse ?? []),
        ...(partial?.hooks?.PostToolUse ?? [])
      ]
    },
    providers: {
      ...(DEFAULT_CONFIG.providers ?? {}),
      ...(partial?.providers ?? {})
    },
    routing: {
      ...(DEFAULT_CONFIG.routing ?? {}),
      ...(partial?.routing ?? {})
    },
    budget: {
      ...(DEFAULT_CONFIG.budget ?? {}),
      ...(partial?.budget ?? {})
    }
  };
}

export function loadConfig(): ZenoConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  const raw = readFileSync(configPath, "utf8");
  const parsed = toml.parse(raw) as Partial<ZenoConfig>;
  return mergeConfig(parsed);
}

export function saveConfig(config: ZenoConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, toml.stringify(config as unknown as toml.JsonMap), "utf8");
}

export function getConfigPathname(): string {
  return getConfigPath();
}

export function updateConfig(mutator: (config: ZenoConfig) => ZenoConfig): ZenoConfig {
  const current = loadConfig();
  const next = mutator(current);
  saveConfig(next);
  return next;
}
