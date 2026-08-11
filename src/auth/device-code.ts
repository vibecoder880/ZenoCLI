/**
 * Device Code Flow (RFC 8628) — OAuth for headless environments.
 *
 * Used when a browser cannot reach the localhost redirect callback (WSL2, SSH,
 * Docker, CI). The user authorizes on another device by visiting a URL and
 * entering a user code; the client polls the token endpoint until the token is
 * issued or the flow expires.
 */

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** Seconds until the device code expires. */
  expiresIn: number;
  /** Poll interval in seconds. */
  interval: number;
}

export interface DeviceTokenResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface DeviceConfig {
  /** Device authorization endpoint. */
  deviceUrl: string;
  /** Token endpoint (for polling). */
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  /** Extra query params for the authorization request (e.g. scope). */
  scope?: string;
}

function buildForm(params: Record<string, string | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      body.set(key, value);
    }
  }
  return body;
}

/** Start a device authorization and return the codes to show the user. */
export async function startDeviceAuthorization(
  config: DeviceConfig
): Promise<DeviceAuthorization> {
  const body = buildForm({
    client_id: config.clientId,
    scope: config.scope,
    ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
  });

  const response = await fetch(config.deviceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Device authorization failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return {
    deviceCode: String(payload.device_code ?? ""),
    userCode: String(payload.user_code ?? ""),
    verificationUri: String(payload.verification_uri ?? payload.verification_url ?? ""),
    expiresIn: Number(payload.expires_in ?? 1800),
    interval: Number(payload.interval ?? 5),
  };
}

/**
 * Poll the token endpoint for the device authorization, honoring the server's
 * interval and expiry. Resolves with the token on success, or throws with a
 * clear message on expiry/denial.
 */
export async function pollForDeviceToken(
  config: DeviceConfig,
  deviceCode: string,
  expiresIn: number,
  interval: number,
  signal?: AbortSignal
): Promise<DeviceTokenResult> {
  const deadline = Date.now() + expiresIn * 1000;

  // Poll immediately, then every `interval` seconds.
  for (;;) {
    if (signal?.aborted) {
      throw new Error("Device code flow cancelled.");
    }
    if (Date.now() > deadline) {
      throw new Error("Device code expired — please run the login again.");
    }

    const body = buildForm({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: config.clientId,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
    });

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal,
    });

    if (response.ok) {
      return (await response.json()) as DeviceTokenResult;
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      // Non-JSON error body — fall through to the generic failure below.
    }

    const error = String(payload.error ?? "");
    if (error === "authorization_pending") {
      // Not yet approved — wait and poll again.
      await sleep(interval * 1000);
      continue;
    }
    if (error === "slow_down") {
      // Server asks to increase the interval.
      await sleep((interval + 5) * 1000);
      continue;
    }
    if (error === "access_denied") {
      throw new Error("Access denied by the user.");
    }
    if (error === "expired_token") {
      throw new Error("Device code expired — please run the login again.");
    }

    throw new Error(`Device token polling failed: ${response.status} ${JSON.stringify(payload)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
