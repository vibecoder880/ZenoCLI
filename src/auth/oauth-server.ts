import http from "node:http";

export async function waitForOAuthCode(port = 9876, timeoutMs = 120_000): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");

      response.statusCode = 200;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("ZenoCLI login received. You can close this tab.");

      clearTimeout(timer);
      server.close();

      if (!code) {
        reject(new Error("OAuth callback did not include a code."));
        return;
      }

      resolve(code);
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timed out."));
    }, timeoutMs);

    server.listen(port, "127.0.0.1");
  });
}
