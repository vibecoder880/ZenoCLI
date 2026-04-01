import { AuthProfileStore } from "../../auth/auth-profiles.js";
import { listProviderCatalog, tryCreateProvider } from "../../providers/index.js";
import { loadConfig } from "../../storage/config.js";

export async function runHealthCommand(): Promise<void> {
  const store = new AuthProfileStore();

  for (const entry of listProviderCatalog()) {
    const created = tryCreateProvider(entry.slug, store);

    if (!created.ok) {
      console.log(`${entry.slug}: unavailable`);
      console.log(`  ${created.error.message}`);
      continue;
    }

    const status = await created.provider.healthCheck();
    console.log(`${entry.slug}: ${status.ok ? "ok" : "error"}`);
    console.log(`  ${status.message}`);
  }
}

export async function runModelsCommand(provider?: string): Promise<void> {
  const config = loadConfig();
  const store = new AuthProfileStore();

  if (!provider) {
    console.log("Configured aliases:");
    for (const [alias, target] of Object.entries(config.aliases)) {
      console.log(`  ${alias} -> ${target}`);
    }
    console.log("");
  }

  const providers = provider ? [provider] : listProviderCatalog().map((entry) => entry.slug);

  for (const providerSlug of providers) {
    const created = tryCreateProvider(providerSlug, store);

    if (!created.ok) {
      console.log(`${providerSlug}: unavailable`);
      console.log(`  ${created.error.message}`);
      continue;
    }

    const models = await created.provider.listModels();
    console.log(`${providerSlug}:`);
    for (const model of models) {
      console.log(`  ${model.id} - ${model.displayName}`);
    }
  }
}
