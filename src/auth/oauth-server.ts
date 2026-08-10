import http from "node:http";

/**
 * Wait for the local OAuth redirect callback and extract the authorization
 * code. The `state` value was generated when the auth URL was built; the
 * provider must echo it back on the callback. Rejecting on a mismatch
 * prevents CSRF / login-request-swapping attacks.
 */
export async function waitForOAuthCode(
  expectedState: string,
  port = 9876,
  timeoutMs = 120_000
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      const finalize = (err?: Error): void => {
        response.statusCode = err ? 400 : 200;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(err ? "OAuth login failed." : "ZenoCLI login received. You can close this tab.");
        clearTimeout(timer);
        server.close();
        if (err) {
          reject(err);
        } else {
          resolve(code!);
        }
      };

      if (!code) {
        finalize(new Error("OAuth callback did not include a code."));
        return;
      }

      if (!state || state !== expectedState) {
        finalize(new Error("OAuth callback state mismatch — login abandoned."));
        return;
      }

      finalize();
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timed out."));
    }, timeoutMs);

    server.listen(port, "127.0.0.1");
  });
}
