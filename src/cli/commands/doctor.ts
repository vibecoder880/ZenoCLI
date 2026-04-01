import process from "node:process";
import { existsSync } from "node:fs";
import { AuthProfileStore } from "../../auth/auth-profiles.js";
import { listProviderCatalog, tryCreateProvider } from "../../providers/index.js";
import { getConfigPathname, loadConfig } from "../../storage/config.js";
import { getAuthProfilesPathname, getHistoryPathname, getProjectInstructionsPath } from "../../storage/paths.js";

export async function runDoctorCommand(cwd: string): Promise<void> {
  const config = loadConfig();
  const store = new AuthProfileStore();

  console.log("Environment");
  console.log(`  node = ${process.version}`);
  console.log(`  cwd = ${cwd}`);
  console.log("");

  console.log("Storage");
  console.log(`  config = ${getConfigPathname()} (${existsSync(getConfigPathname()) ? "present" : "missing"})`);
  console.log(
    `  auth profiles = ${getAuthProfilesPathname()} (${existsSync(getAuthProfilesPathname()) ? "present" : "missing"})`
  );
  console.log(`  history = ${getHistoryPathname()} (${existsSync(getHistoryPathname()) ? "present" : "missing"})`);
  console.log(
    `  project context = ${getProjectInstructionsPath(cwd)} (${existsSync(getProjectInstructionsPath(cwd)) ? "present" : "missing"})`
  );
  console.log("");

  console.log("Config");
  console.log(`  default.model = ${config.default.model}`);
  console.log(`  default.provider = ${config.default.provider}`);
  console.log(`  default.streaming = ${config.default.streaming}`);
  console.log("");

  console.log("Credentials");
  for (const provider of listProviderCatalog()) {
    const envNames =
      provider.slug === "openai"
        ? ["OPENAI_API_KEY"]
        : provider.slug === "anthropic"
          ? ["ANTHROPIC_API_KEY"]
          : ["GOOGLE_API_KEY", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"];
    const envPresent = envNames.filter((name) => Boolean(process.env[name]));
    const profiles = store.listProfiles(provider.slug);
    console.log(
      `  ${provider.slug}: env=${envPresent.length > 0 ? envPresent.join(",") : "none"} profiles=${profiles.length}`
    );
  }
  console.log("");

  console.log("Providers");
  for (const provider of listProviderCatalog()) {
    const created = tryCreateProvider(provider.slug, store);
    if (!created.ok) {
      console.log(`  ${provider.slug}: unavailable`);
      continue;
    }

    const status = await created.provider.healthCheck();
    console.log(`  ${provider.slug}: ${status.ok ? "ok" : "error"}`);
  }
  console.log("");

  console.log("Release Readiness");
  console.log(`  NPM_TOKEN present = ${Boolean(process.env.NPM_TOKEN)}`);
  console.log(`  package name = neuro-cli`);
}
