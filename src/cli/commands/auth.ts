import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { AuthProfileStore, getKnownProviders, isProfileExpired, maskSecret } from "../../auth/auth-profiles.js";
import { waitForOAuthCode } from "../../auth/oauth-server.js";
import { pollForDeviceToken, startDeviceAuthorization } from "../../auth/device-code.js";
import {
  buildAuthorizationUrl,
  createOAuthState,
  createPKCEChallenge,
  createPKCEVerifier,
  exchangeAuthorizationCode,
  fetchOAuthEmail,
  getDeviceOAuthConfig,
  getOAuthConfig,
  openAuthorizationUrl,
  promptForAuthorizationCode,
  refreshOAuthToken
} from "../../auth/oauth.js";

function registerLoginCommand(command: Command): void {
  command
    .command("login")
    .description("Add a provider credential")
    .argument("<provider>", "Provider slug")
    .requiredOption("--method <method>", "Auth method: api-key or oauth")
    .option("--label <label>", "Friendly profile label")
    .option("--key <key>", "API key to store")
    .option("--manual-code", "Paste authorization code instead of waiting for localhost callback")
    .option("--device", "Use Device Code Flow (for WSL/SSH/Docker/CI)")
    .action(
      async (
        provider: string,
        options: { method: string; label?: string; key?: string; manualCode?: boolean; device?: boolean }
      ) => {
      const store = new AuthProfileStore();

      if (options.method === "oauth" && options.device) {
        await runDeviceLogin(provider, store);
        return;
      }

      if (options.method === "oauth") {
        const config = getOAuthConfig(provider);
        const state = createOAuthState();
        // PKCE S256: the code_verifier is kept locally and sent only on the
        // token exchange, so an intercepted authorization code cannot be
        // redeemed by an attacker who lacks it.
        const codeVerifier = createPKCEVerifier();
        const authUrl = buildAuthorizationUrl(config, state, createPKCEChallenge(codeVerifier));
        console.log(`Starting OAuth login for ${provider}`);
        console.log(`Redirect URI: ${config.redirectUri}`);
        await openAuthorizationUrl(authUrl);
        console.log(`If the browser does not open, visit:\n${authUrl}`);

        let code: string;

        if (options.manualCode) {
          code = await promptForAuthorizationCode();
        } else {
          const port = Number(new URL(config.redirectUri).port || "9876");
          try {
            code = await waitForOAuthCode(state, port);
          } catch {
            console.log("Local callback was not received. Paste the authorization code instead.");
            code = await promptForAuthorizationCode();
          }
        }

        const token = await exchangeAuthorizationCode(config, code, codeVerifier);
        const email = await fetchOAuthEmail(config, token.access_token);
        const profile = store.saveProfile({
          type: "oauth",
          provider,
          access: token.access_token,
          refresh: token.refresh_token ?? "",
          expires: Date.now() + (token.expires_in ?? 3600) * 1000,
          email
        });

        console.log(`Saved OAuth profile ${profile.id}`);
        return;
      }

      if (options.method !== "api-key") {
        console.error("Supported login methods are api-key and oauth.");
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

/** OAuth via Device Code Flow — for WSL/SSH/Docker/CI where localhost is unreachable. */
async function runDeviceLogin(provider: string, store: AuthProfileStore): Promise<void> {
  const deviceConfig = getDeviceOAuthConfig(provider);
  console.log(`Starting device-code OAuth login for ${provider}`);

  const auth = await startDeviceAuthorization(deviceConfig);
  console.log(`\nVisit: ${auth.verificationUri}`);
  console.log(`Enter code: ${auth.userCode}\n`);
  console.log("Waiting for authorization...");

  const token = await pollForDeviceToken(
    deviceConfig,
    auth.deviceCode,
    auth.expiresIn,
    auth.interval
  );

  const profile = store.saveProfile({
    type: "oauth",
    provider,
    access: token.access_token,
    refresh: token.refresh_token ?? "",
    expires: Date.now() + (token.expires_in ?? 3600) * 1000
  });
  console.log(`Saved OAuth profile ${profile.id}`);
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
      const providers = getKnownProviders();

      for (const provider of providers) {
        const active = store.getActiveProfile(provider);
        const allProfiles = store.listProfiles(provider);
        const status = active
          ? `active=${active.id} type=${active.type} expired=${isProfileExpired(active)}`
          : allProfiles.length > 0
            ? `profiles=${allProfiles.length} no active profile`
            : "not configured";
        console.log(`${provider}: ${status}`);
      }
    });
}

function registerRefreshCommand(command: Command): void {
  command
    .command("refresh")
    .description("Refresh an OAuth profile using its refresh token")
    .argument("<provider>", "Provider slug")
    .option("--profile <profileId>", "Specific profile to refresh")
    .action(async (provider: string, options: { profile?: string }) => {
      const store = new AuthProfileStore();
      const profile =
        options.profile !== undefined
          ? store.listProfiles(provider).find((entry) => entry.id === options.profile)
          : store.getActiveProfile(provider);

      if (!profile) {
        throw new Error(`No profile found for provider ${provider}.`);
      }

      if (profile.type !== "oauth") {
        throw new Error(`Profile ${profile.id} is not an OAuth profile.`);
      }

      if (!profile.refresh) {
        throw new Error(`Profile ${profile.id} does not have a refresh token.`);
      }

      const config = getOAuthConfig(provider);
      const token = await refreshOAuthToken(config, profile.refresh);
      const updated = store.updateProfile(profile.id, (current) => {
        if (current.type !== "oauth") {
          return current;
        }

        return {
          ...current,
          access: token.access_token,
          refresh: token.refresh_token ?? current.refresh,
          expires: Date.now() + (token.expires_in ?? 3600) * 1000
        };
      });

      console.log(`Refreshed ${updated.id}`);
    });
}

/** Validate stored credentials and print a per-provider status. Sets exit 1 when any check fails. */
export function runAuthHealth(providerFilter?: string): void {
  const store = new AuthProfileStore();
  const providers = providerFilter ? [providerFilter] : getKnownProviders();
  let healthy = true;

  for (const provider of providers) {
    const active = store.getActiveProfile(provider);
    const allProfiles = store.listProfiles(provider);

    if (!active) {
      // No active profile at all — only mark unhealthy if nothing is stored.
      if (allProfiles.length === 0) {
        console.log(`✗ ${provider}: not configured`);
        healthy = false;
      } else {
        console.log(`⚠ ${provider}: profiles present, no active profile (run zeno auth switch)`);
        healthy = false;
      }
      continue;
    }

    if (isProfileExpired(active)) {
      console.log(`✗ ${provider}: active profile "${active.id}" is expired`);
      healthy = false;
      continue;
    }

    if (active.type === "oauth" && !active.refresh) {
      console.log(`✗ ${provider}: active profile "${active.id}" has no refresh token`);
      healthy = false;
      continue;
    }

    console.log(`✓ ${provider}: ${active.type} profile "${active.id}" valid`);
  }

  if (!healthy) {
    process.exitCode = 1;
  }
}

function registerHealthCommand(command: Command): void {
  command
    .command("health")
    .description("Validate stored provider credentials")
    .option("--provider <provider>", "Check a single provider")
    .action((options: { provider?: string }) => {
      runAuthHealth(options.provider);
    });
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Authentication commands");
  registerLoginCommand(auth);
  registerListCommand(auth);
  registerSwitchCommand(auth);
  registerRemoveCommand(auth);
  registerStatusCommand(auth);
  registerRefreshCommand(auth);
  registerHealthCommand(auth);
}
