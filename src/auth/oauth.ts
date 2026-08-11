import { createHash, randomBytes } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import open from "open";

interface OAuthProviderConfig {
  provider: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  userInfoUrl?: string;
  userEmailField?: string;
  /** Device authorization endpoint (RFC 8628), if the provider supports it. */
  deviceUrl?: string;
}

/** Config for the device code flow, derived from the provider OAuth config. */
export function getDeviceOAuthConfig(provider: string): {
  deviceUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
} {
  const config = getOAuthConfig(provider);
  if (!config.deviceUrl) {
    throw new Error(`Device code flow is not supported for provider "${provider}".`);
  }
  return {
    deviceUrl: config.deviceUrl,
    tokenUrl: config.tokenUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scope: config.scopes.join(" "),
  };
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable ${name} for OAuth login.`);
  }

  return value;
}

function getGoogleOAuthConfig(): OAuthProviderConfig {
  return {
    provider: "google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    deviceUrl: "https://oauth2.googleapis.com/device/code",
    clientId: getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:9876/callback",
    scopes: (process.env.GOOGLE_OAUTH_SCOPES ?? "openid email profile").split(/\s+/),
    extraAuthParams: {
      access_type: "offline",
      prompt: "consent"
    },
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    userEmailField: "email"
  };
}

function getOpenAiOAuthConfig(): OAuthProviderConfig {
  return {
    provider: "openai",
    authUrl: getRequiredEnv("OPENAI_OAUTH_AUTH_URL"),
    tokenUrl: getRequiredEnv("OPENAI_OAUTH_TOKEN_URL"),
    deviceUrl: process.env.OPENAI_OAUTH_DEVICE_URL,
    clientId: getRequiredEnv("OPENAI_OAUTH_CLIENT_ID"),
    clientSecret: process.env.OPENAI_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.OPENAI_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:9876/callback",
    scopes: (process.env.OPENAI_OAUTH_SCOPES ?? "openid profile email offline_access").split(/\s+/),
    userInfoUrl: process.env.OPENAI_OAUTH_USERINFO_URL,
    userEmailField: process.env.OPENAI_OAUTH_USERINFO_EMAIL_FIELD ?? "email"
  };
}

export function getOAuthConfig(provider: string): OAuthProviderConfig {
  switch (provider) {
    case "google":
      return getGoogleOAuthConfig();
    case "openai":
      return getOpenAiOAuthConfig();
    default:
      throw new Error(`OAuth login is not supported for provider "${provider}".`);
  }
}

/** RFC 7636 PKCE helpers (S256). Pure node:crypto — no extra dependency. */

/**
 * Generate a high-entropy `code_verifier` for PKCE.
 * 43–128 chars, default 64; only unreserved ASCII chars per RFC 3986.
 */
export function createPKCEVerifier(): string {
  return randomBytes(48)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Compute the S256 `code_challenge` for a `code_verifier`:
 * base64url(SHA256(code_verifier)) with no padding.
 */
export function createPKCEChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier, "ascii")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildAuthorizationUrl(config: OAuthProviderConfig, state: string, codeChallenge?: string): string {
  const url = new URL(config.authUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);

  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  for (const [key, value] of Object.entries(config.extraAuthParams ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function createOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export async function openAuthorizationUrl(url: string): Promise<void> {
  try {
    await open(url);
  } catch {
    console.log("Browser auto-open failed. Open this URL manually:");
    console.log(url);
  }
}

export async function promptForAuthorizationCode(promptLabel = "Paste authorization code"): Promise<string> {
  const rl = createInterface({ input, output });
  const code = await rl.question(`${promptLabel}: `);
  rl.close();
  return code.trim();
}

export async function exchangeAuthorizationCode(
  config: OAuthProviderConfig,
  code: string,
  codeVerifier?: string
): Promise<OAuthTokenResponse> {
  return await postOAuthTokenRequest(config, {
    grant_type: "authorization_code",
    code,
    ...(codeVerifier ? { code_verifier: codeVerifier } : {})
  });
}

export async function refreshOAuthToken(
  config: OAuthProviderConfig,
  refreshToken: string
): Promise<OAuthTokenResponse> {
  return await postOAuthTokenRequest(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
}

async function postOAuthTokenRequest(
  config: OAuthProviderConfig,
  payload: Record<string, string>
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams();
  body.set("client_id", config.clientId);
  body.set("redirect_uri", config.redirectUri);
  for (const [key, value] of Object.entries(payload)) {
    body.set(key, value);
  }

  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as OAuthTokenResponse;
}

export async function fetchOAuthEmail(
  config: OAuthProviderConfig,
  accessToken: string
): Promise<string | undefined> {
  if (!config.userInfoUrl) {
    return undefined;
  }

  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const value = payload[config.userEmailField ?? "email"];
  return typeof value === "string" ? value : undefined;
}
