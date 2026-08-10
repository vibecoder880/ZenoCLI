/**
 * Automatic OAuth token refresh.
 *
 * Refresh an OAuth access token before it expires so requests keep working
 * without a full re-auth. Runs at the async CLI seams (chat/agent) where a
 * provider is about to be created; failures degrade gracefully — the caller
 * falls back to the stored token rather than blocking.
 */

import type { AuthProfileStore, StoredAuthProfile } from "./auth-profiles.js";
import { isOAuthNearExpiry } from "./auth-profiles.js";
import { getOAuthConfig, refreshOAuthToken } from "./oauth.js";

export const DEFAULT_REFRESH_BUFFER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Refresh the active OAuth profile for `provider` if its access token is
 * within `bufferMs` of expiry and it carries a refresh token.
 *
 * @returns true when a refresh happened, false when nothing was needed or the
 *          refresh failed (caller should keep using the stored token).
 */
export async function refreshOAuthIfNeeded(
  store: AuthProfileStore,
  provider: string,
  bufferMs = DEFAULT_REFRESH_BUFFER_MS
): Promise<boolean> {
  const profile = store.getActiveProfile(provider);

  if (!isRefreshableOAuthProfile(profile, bufferMs)) {
    return false;
  }

  try {
    const config = getOAuthConfig(provider);
    const token = await refreshOAuthToken(config, profile.refresh);
    store.updateProfile(profile.id, (current) => {
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
    return true;
  } catch (error) {
    // Do not fail the request — the caller keeps using the stored token.
    console.warn(
      `[zeno] Auto-refresh of ${provider} OAuth token failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return false;
  }
}

function isRefreshableOAuthProfile(
  profile: StoredAuthProfile | undefined,
  bufferMs: number
): profile is StoredAuthProfile & { type: "oauth"; refresh: string } {
  return (
    profile?.type === "oauth" &&
    profile.refresh.length > 0 &&
    isOAuthNearExpiry(profile, bufferMs)
  );
}
