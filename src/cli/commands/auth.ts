import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { AuthProfileStore, maskSecret } from "../../auth/auth-profiles.js";

function registerLoginCommand(command: Command): void {
  command
    .command("login")
    .description("Add a provider credential")
    .argument("<provider>", "Provider slug")
    .requiredOption("--method <method>", "Auth method: api-key or oauth")
    .option("--label <label>", "Friendly profile label")
    .option("--key <key>", "API key to store")
    .action(async (provider: string, options: { method: string; label?: string; key?: string }) => {
      const store = new AuthProfileStore();

      if (options.method !== "api-key") {
        console.error("OAuth flow is not implemented yet. Use --method api-key for now.");
        process.exitCode = 1;
        return;
      }

      let apiKey = options.key;

      if (!apiKey) {
        const rl = createInterface({ input, output });
        apiKey = await rl.question(`${provider} API key: `);
        rl.close();
      }

      const profile = store.saveProfile({
        type: "api_key",
        provider,
        key: apiKey.trim(),
        label: options.label
      });

      console.log(`Saved profile ${profile.id}`);
    });
}

function registerListCommand(command: Command): void {
  command
    .command("list")
    .description("List saved provider credentials")
    .argument("[provider]", "Optional provider slug")
    .action((provider?: string) => {
      const store = new AuthProfileStore();
      const profiles = store.listProfiles(provider);

      if (profiles.length === 0) {
        console.log("No auth profiles saved.");
        return;
      }

      for (const profile of profiles) {
        const active = store.getActiveProfile(profile.provider)?.id === profile.id ? "*" : " ";
        const secret =
          profile.type === "api_key"
            ? maskSecret(profile.key)
            : profile.type === "oauth"
              ? maskSecret(profile.access)
              : maskSecret(profile.token);
        console.log(`${active} ${profile.id} (${profile.type}) ${secret}`);
      }
    });
}

function registerSwitchCommand(command: Command): void {
  command
    .command("switch")
    .description("Set the active profile for a provider")
    .argument("<provider>", "Provider slug")
    .argument("<profileId>", "Profile identifier")
    .action((provider: string, profileId: string) => {
      const store = new AuthProfileStore();
      store.setActiveProfile(provider, profileId);
      console.log(`Active profile for ${provider} set to ${profileId}`);
    });
}

function registerRemoveCommand(command: Command): void {
  command
    .command("remove")
    .description("Delete a saved profile")
    .argument("<profileId>", "Profile identifier")
    .action((profileId: string) => {
      const store = new AuthProfileStore();
      const removed = store.removeProfile(profileId);

      if (!removed) {
        console.error(`Profile ${profileId} was not found.`);
        process.exitCode = 1;
        return;
      }

      console.log(`Removed ${profileId}`);
    });
}

function registerStatusCommand(command: Command): void {
  command
    .command("status")
    .description("Show provider credential status")
    .action(() => {
      const store = new AuthProfileStore();
      const providers = ["openai", "anthropic", "google"];

      for (const provider of providers) {
        const active = store.getActiveProfile(provider);
        console.log(
          `${provider}: ${active ? `active=${active.id} type=${active.type}` : "not configured"}`
        );
      }
    });
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Authentication commands");
  registerLoginCommand(auth);
  registerListCommand(auth);
  registerSwitchCommand(auth);
  registerRemoveCommand(auth);
  registerStatusCommand(auth);
}
