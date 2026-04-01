import { AuthProfileStore, isProfileExpired } from "../auth/auth-profiles.js";

export function resolveProviderSecret(
  store: AuthProfileStore,
  provider: string,
  envVarName: string
): string | undefined {
  const envSecret = process.env[envVarName];

  if (envSecret) {
    return envSecret;
  }

  const profile = store.getPreferredProfile(provider);

  if (!profile) {
    return undefined;
  }

  if (isProfileExpired(profile)) {
    return undefined;
  }

  if (profile.type === "api_key") {
    return profile.key;
  }

  if (profile.type === "oauth") {
    return profile.access;
  }

  return profile.token;
}
