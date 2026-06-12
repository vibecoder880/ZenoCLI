import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureAppDataDirectory } from "../storage/paths.js";

export type AuthProfile =
  | { type: "api_key"; provider: string; key: string; label?: string }
  | {
      type: "oauth";
      provider: string;
      access: string;
      refresh: string;
      expires: number;
      email?: string;
    }
  | { type: "token"; provider: string; token: string; expires?: number; label?: string };

export type StoredAuthProfile = AuthProfile & {
  id: string;
  createdAt: number;
  updatedAt: number;
  cooldownUntil?: number;
};

interface AuthStoreData {
  profiles: Record<string, StoredAuthProfile>;
  activeProfiles: Record<string, string>;
}

const DEFAULT_STORE: AuthStoreData = {
  profiles: {},
  activeProfiles: {}
};

function getStorePath(): string {
  return path.join(ensureAppDataDirectory(), "auth-profiles.json");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function createProfileId(profile: AuthProfile): string {
  const suffix =
    profile.type === "oauth"
      ? profile.email ?? "oauth"
      : profile.label ?? `${profile.type}-${Date.now()}`;

  return `${profile.provider}:${slugify(suffix)}`;
}

export class AuthProfileStore {
  public load(): AuthStoreData {
    const storePath = getStorePath();

    if (!existsSync(storePath)) {
      this.save(DEFAULT_STORE);
      return DEFAULT_STORE;
    }

    return JSON.parse(readFileSync(storePath, "utf8")) as AuthStoreData;
  }

  public save(data: AuthStoreData): void {
    writeFileSync(getStorePath(), JSON.stringify(data, null, 2), "utf8");
  }

  public listProfiles(provider?: string): StoredAuthProfile[] {
    const data = this.load();

    return Object.values(data.profiles).filter((profile) =>
      provider ? profile.provider === provider : true
    );
  }

  public saveProfile(profile: AuthProfile, profileId = createProfileId(profile)): StoredAuthProfile {
    const data = this.load();
    const now = Date.now();
    const existing = data.profiles[profileId];
    const storedProfile: StoredAuthProfile = {
      ...profile,
      id: profileId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      cooldownUntil: existing?.cooldownUntil
    };

    data.profiles[profileId] = storedProfile;
    data.activeProfiles[profile.provider] = profileId;
    this.save(data);
    return storedProfile;
  }

  public removeProfile(profileId: string): boolean {
    const data = this.load();
    const profile = data.profiles[profileId];

    if (!profile) {
      return false;
    }

    delete data.profiles[profileId];

    if (data.activeProfiles[profile.provider] === profileId) {
      delete data.activeProfiles[profile.provider];
    }

    this.save(data);
    return true;
  }

  public setActiveProfile(provider: string, profileId: string): void {
    const data = this.load();
    const profile = data.profiles[profileId];

    if (!profile || profile.provider !== provider) {
      throw new Error(`Profile "${profileId}" does not belong to provider "${provider}".`);
    }

    data.activeProfiles[provider] = profileId;
    this.save(data);
  }

  public getActiveProfile(provider: string): StoredAuthProfile | undefined {
    const data = this.load();
    const profileId = data.activeProfiles[provider];

    if (!profileId) {
      return undefined;
    }

    return data.profiles[profileId];
  }

  public getPreferredProfile(provider: string): StoredAuthProfile | undefined {
    const profiles = this.listProfiles(provider)
      .filter(
        (profile) =>
          (!profile.cooldownUntil || profile.cooldownUntil < Date.now()) && !isProfileExpired(profile)
      )
      .sort((left, right) => {
        const score = (profile: StoredAuthProfile): number => {
          if (profile.type === "oauth") {
            return 3;
          }

          if (profile.type === "token") {
            return 2;
          }

          return 1;
        };

        return score(right) - score(left) || right.updatedAt - left.updatedAt;
      });

    const active = this.getActiveProfile(provider);
    if (active && !isProfileExpired(active)) {
      return active;
    }

    return profiles[0];
  }

  public markCooldown(profileId: string, cooldownMs: number): void {
    const data = this.load();
    const profile = data.profiles[profileId];

    if (!profile) {
      throw new Error(`Profile "${profileId}" was not found.`);
    }

    profile.cooldownUntil = Date.now() + cooldownMs;
    profile.updatedAt = Date.now();
    this.save(data);
  }

  public updateProfile(profileId: string, updater: (profile: StoredAuthProfile) => StoredAuthProfile): StoredAuthProfile {
    const data = this.load();
    const profile = data.profiles[profileId];

    if (!profile) {
      throw new Error(`Profile "${profileId}" was not found.`);
    }

    const updated = updater(profile);
    data.profiles[profileId] = {
      ...updated,
      id: profile.id,
      createdAt: profile.createdAt,
      updatedAt: Date.now()
    };
    this.save(data);
    return data.profiles[profileId];
  }
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return `${secret.slice(0, 2)}...${secret.slice(-1)}`;
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function isProfileExpired(profile: StoredAuthProfile, now = Date.now()): boolean {
  if (profile.type === "oauth") {
    return profile.expires <= now;
  }

  if (profile.type === "token" && profile.expires) {
    return profile.expires <= now;
  }

  return false;
}

export const KNOWN_PROVIDERS = ["openai", "anthropic", "google"] as const;
export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

export function hasAnyActiveProfile(providers: readonly string[] = KNOWN_PROVIDERS): boolean {
  const store = new AuthProfileStore();
  for (const provider of providers) {
    const profile = store.getActiveProfile(provider);
    if (profile && !isProfileExpired(profile)) {
      return true;
    }
  }
  return false;
}

export function listMissingProviders(providers: readonly string[] = KNOWN_PROVIDERS): string[] {
  const store = new AuthProfileStore();
  return providers.filter((provider) => {
    const profile = store.getActiveProfile(provider);
    return !profile || isProfileExpired(profile);
  });
}
