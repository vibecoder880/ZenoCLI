import { getConfigPathname, loadConfig, updateConfig } from "../../storage/config.js";

export function runConfigShowCommand(): void {
  const config = loadConfig();

  console.log(`Config path: ${getConfigPathname()}`);
  console.log(`default.model = ${config.default.model}`);
  console.log(`default.provider = ${config.default.provider}`);
  console.log(`default.streaming = ${config.default.streaming}`);
  console.log("aliases:");

  for (const [alias, target] of Object.entries(config.aliases)) {
    console.log(`  ${alias} -> ${target}`);
  }
}

export function runConfigSetCommand(key: string, value: string): void {
  const updated = updateConfig((config) => {
    if (key === "default.model") {
      return {
        ...config,
        default: {
          ...config.default,
          model: value
        }
      };
    }

    if (key === "default.provider") {
      return {
        ...config,
        default: {
          ...config.default,
          provider: value
        }
      };
    }

    if (key === "default.streaming") {
      return {
        ...config,
        default: {
          ...config.default,
          streaming: value === "true"
        }
      };
    }

    if (key.startsWith("aliases.")) {
      const alias = key.slice("aliases.".length);
      return {
        ...config,
        aliases: {
          ...config.aliases,
          [alias]: value
        }
      };
    }

    throw new Error(`Unsupported config key "${key}".`);
  });

  console.log(`Updated ${key}`);
  console.log(`Config path: ${getConfigPathname()}`);
  console.log(`Active default model: ${updated.default.model}`);
}
