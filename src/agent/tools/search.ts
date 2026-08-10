/**
 * Web search and fetch tools.
 * Uses DuckDuckGo for search (free, no API key needed) and native fetch for URLs.
 */

import type { ToolDefinition } from "../tool-registry.js";

// ---- Web Search (DuckDuckGo HTML lite) ----

const webSearchTool: ToolDefinition = {
  name: "web_search",
  description: "Search the web using DuckDuckGo. Returns up to 10 results with titles and URLs.",
  category: "web",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query." },
      max_results: { type: "number", description: "Max results to return (default: 10, max: 20)." },
    },
    required: ["query"],
  },
  async execute(params): Promise<{ output: string; error?: string }> {
    const query = String(params.query ?? "");
    const maxResults = Math.min(Number(params.max_results) || 10, 20);

    if (!query) {
      return { output: "", error: "Search query is required." };
    }

    try {
      // Use DuckDuckGo HTML Lite API
      const url = `https://lite.duckduckgo.com/lite?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ZenoCli/1.0)",
        },
      });

      if (!response.ok) {
        return { output: "", error: `Search failed: HTTP ${response.status}` };
      }

      const html = await response.text();

      const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

      let linkMatch: RegExpExecArray | null;
      const links: Array<{ url: string; title: string }> = [];

      while ((linkMatch = linkRegex.exec(html)) !== null && links.length < maxResults) {
        const url = linkMatch[1];
        const title = linkMatch[2].replace(/<[^>]+>/g, "").trim();
        if (url && !url.startsWith("/") && title) {
          links.push({ url, title });
        }
      }

      // Fallback: try extracting any links if DDG format changed
      if (links.length === 0) {
        const anyLinkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gi;
        let m: RegExpExecArray | null;
        while ((m = anyLinkRegex.exec(html)) !== null && links.length < maxResults) {
          const title = m[2].replace(/<[^>]+>/g, "").trim();
          if (title && title.length > 5) {
            links.push({ url: m[1], title });
          }
        }
      }

      if (links.length === 0) {
        return { output: `No results found for "${query}".` };
      }

      const output = links
        .map((link, i) => `${i + 1}. ${link.title}\n   ${link.url}`)
        .join("\n\n");

      return { output };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: "", error: `Web search failed: ${message}` };
    }
  },
};

// ---- Web Fetch ----

/**
 * SSRF guard for the web_fetch tool.
 *
 * Prevents the agent from reaching non-public targets (loopback, private and
 * link-local networks, and metadata services) that LLM-generated URLs should
 * never access. Fetching runs on the user's machine, so without this the agent
 * could probe internal services (e.g. 169.254.169.254 cloud metadata, router
 * admin panels, local ports) and exfiltrate the responses.
 */

/** True when an IP is loopback, private, link-local, or a known metadata range. */
function isBlockedIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map((octet) => Number(octet));
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }
  return (
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local + cloud metadata
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    a === 0 // 0.0.0.0/8
  );
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" || // loopback
    lower.startsWith("fc") || lower.startsWith("fd") || // ULA fc00::/7
    lower.startsWith("fe80") // link-local fe80::/10
  );
}

/** True if the hostname itself is reserved or clearly internal. */
function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  return (
    lower === "localhost" ||
    lower === "metadata.google.internal" ||
    lower === "metadata.goog" ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower.endsWith(".localhost")
  );
}

/** URLs we can safely fetch — https, no credentials, public target. */
function isSafeFetchUrl(url: string): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Only https URLs are allowed (http/plaintext is blocked)" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URLs with embedded credentials are blocked" };
  }

  const hostname = parsed.hostname;
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: `Host "${hostname}" is reserved or internal` };
  }

  // Raw-IP URLs (https://1.2.3.4/...) can be checked directly.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isBlockedIpv4(hostname)) {
      return { ok: false, reason: `IP ${hostname} is a private/reserved address` };
    }
    return { ok: true };
  }
  if (hostname.includes(":")) {
    // IPv6 literal in the host slot — strip the surrounding brackets.
    const ipv6 = hostname.replace(/^\[|\]$/g, "");
    if (isBlockedIpv6(ipv6)) {
      return { ok: false, reason: `IP ${ipv6} is a private/reserved address` };
    }
    return { ok: true };
  }

  return { ok: true };
}

/** Deterministically validate a URL (https-only, public hosts). */
export function validateFetchUrl(url: string): { ok: boolean; reason?: string } {
  return isSafeFetchUrl(url);
}

/** Validate a URL while permitting the caller to opt into loopback/private hosts. */
export function validateFetchUrlInsecure(url: string): { ok: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { ok: false, reason: "Only https URLs are allowed (http/plaintext is blocked)" };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, reason: "URLs with embedded credentials are blocked" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
}

const webFetchTool: ToolDefinition = {
  name: "web_fetch",
  description: "Fetch a URL and return its content as text. Supports HTML pages, JSON APIs, and plain text.",
  category: "web",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch (https only, public hosts)." },
      max_length: { type: "number", description: "Max characters to return (default: 10000)." },
      allow_private: { type: "boolean", description: "Allow loopback/private hosts (default: false)." },
    },
    required: ["url"],
  },
  async execute(params): Promise<{ output: string; error?: string }> {
    const url = String(params.url ?? "");
    const maxLength = Number(params.max_length) || 10000;
    const allowPrivate = Boolean(params.allow_private);

    if (!url) {
      return { output: "", error: "URL is required." };
    }

    // allow_private:true is an explicit, dangerous opt-out for intentional
// localhost-fetch scenarios; keep the protocol/credentials checks regardless.
const validated = allowPrivate ? validateFetchUrlInsecure(url) : validateFetchUrl(url);
    if (!validated.ok) {
      return { output: "", error: `Blocked by SSRF guard: ${validated.reason}` };
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ZenoCli/1.0)",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return { output: "", error: `Fetch failed: HTTP ${response.status}` };
      }

      const contentType = response.headers.get("content-type") ?? "";
      let text = await response.text();

      // Strip HTML tags for HTML content
      if (contentType.includes("text/html")) {
        text = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
      }

      if (text.length > maxLength) {
        text = text.slice(0, maxLength) + "\n... (truncated)";
      }

      return { output: text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: "", error: `Fetch failed: ${message}` };
    }
  },
};

// ---- Export all definitions ----

export const searchToolDefinitions: ToolDefinition[] = [
  webSearchTool,
  webFetchTool,
];
