/**
 * Web search and fetch tools.
 * Uses DuckDuckGo for search (free, no API key needed) and native fetch for URLs.
 */

import type { ToolDefinition } from "../tool-registry.js";
import dns from "node:dns/promises";

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

  // IPv4-mapped IPv6: ::ffff:1.2.3.4 or ::ffff:7f00:1
  // Normalize the embedded IPv4 and check it
  const ipv4MappedMatch = lower.match(/^::ffff:([0-9a-f:.]+)$/i);
  if (ipv4MappedMatch) {
    const inner = ipv4MappedMatch[1];
    const normalized = normalizeIpLiteral(`::ffff:${inner}`);
    if (normalized) {
      return isBlockedIpv4(normalized);
    }
  }

  return (
    lower === "::1" || // loopback
    lower.startsWith("fc") || lower.startsWith("fd") || // ULA fc00::/7
    lower.startsWith("fe80") // link-local fe80::/10
  );
}

/**
 * Normalize various IPv4 literal forms to dotted-decimal notation.
 * Handles: hex (0x7f000001), octal (0177.0.0.1), decimal integer (2130706433),
 * and IPv4-mapped IPv6 (::ffff:1.2.3.4, ::ffff:7f00:1, etc.).
 * Returns dotted-decimal string (e.g., "127.0.0.1") or null if not an IPv4 literal.
 */
function normalizeIpLiteral(raw: string): string | null {
  const s = raw.trim();

  // IPv4-mapped IPv6: ::ffff:1.2.3.4 or ::ffff:7f00:1 (compressed hex)
  const ipv4MappedMatch = s.match(/^::ffff:([0-9a-fA-F:.]+)$/i);
  if (ipv4MappedMatch) {
    const inner = ipv4MappedMatch[1];
    // If inner contains dots, it's already dotted decimal; recurse to handle octal/hex inside
    if (inner.includes(".")) {
      return normalizeIpLiteral(inner);
    }
    // Handle compressed hex form (e.g., "7f00:1" -> "7f000001")
    if (inner.includes(":")) {
      const parts = inner.split(":");
      // Each part is a 16-bit hex value; expand to full 32-bit
      const fullHex = parts.map((p) => p.padStart(4, "0")).join("");
      const asHex = parseInt(fullHex, 16);
      if (Number.isFinite(asHex) && asHex >= 0 && asHex <= 0xffffffff) {
        return [
          (asHex >>> 24) & 0xff,
          (asHex >>> 16) & 0xff,
          (asHex >>> 8) & 0xff,
          asHex & 0xff,
        ].join(".");
      }
      return null;
    }
    // Full hex form (e.g., "01020304")
    const asHex = parseInt(inner, 16);
    if (Number.isFinite(asHex) && asHex >= 0 && asHex <= 0xffffffff) {
      return [
        (asHex >>> 24) & 0xff,
        (asHex >>> 16) & 0xff,
        (asHex >>> 8) & 0xff,
        asHex & 0xff,
      ].join(".");
    }
    return null;
  }

  // Hex literal: 0x7f000001
  if (/^0x[0-9a-fA-F]+$/.test(s)) {
    const val = parseInt(s, 16);
    if (Number.isFinite(val) && val >= 0 && val <= 0xffffffff) {
      return [
        (val >>> 24) & 0xff,
        (val >>> 16) & 0xff,
        (val >>> 8) & 0xff,
        val & 0xff,
      ].join(".");
    }
    return null;
  }

  // Decimal integer literal: 2130706433
  if (/^\d+$/.test(s)) {
    const val = parseInt(s, 10);
    if (Number.isFinite(val) && val >= 0 && val <= 0xffffffff) {
      return [
        (val >>> 24) & 0xff,
        (val >>> 16) & 0xff,
        (val >>> 8) & 0xff,
        val & 0xff,
      ].join(".");
    }
    return null;
  }

  // Dotted notation with possible octal components: 0177.0.0.1
  if (/^\d+(\.\d+){3}$/.test(s)) {
    const parts = s.split(".").map((p) => {
      // Leading zero = octal in many parsers; treat as octal if starts with 0 and has more digits
      if (p.startsWith("0") && p.length > 1) {
        return parseInt(p, 8);
      }
      return parseInt(p, 10);
    });
    if (parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      return parts.join(".");
    }
    return null;
  }

  return null;
}

/**
 * Check if a string is an IPv4 literal (dotted, or encoded form).
 * Returns the normalized dotted-decimal if yes, else null.
 */
function parseIpv4Literal(host: string): string | null {
  // Already dotted-decimal
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".").map((p) => Number(p));
    if (parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      return host;
    }
    return null;
  }
  // Try encoded forms
  return normalizeIpLiteral(host);
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

/** Check if a port is allowed (80, 443). */
function isAllowedPort(port: string | null, protocol: string): boolean {
  if (!port) {
    // Default ports
    return protocol === "https:" || protocol === "http:";
  }
  const portNum = Number(port);
  if (!Number.isFinite(portNum)) return false;
  // Only allow 80 (http) and 443 (https)
  return portNum === 80 || portNum === 443;
}

/** Check if an IP (IPv4 or IPv6) is blocked. */
function isBlockedIp(ip: string): boolean {
  // Try as IPv4
  const ipv4 = parseIpv4Literal(ip);
  if (ipv4) {
    return isBlockedIpv4(ipv4);
  }
  // Try as IPv6
  if (ip.includes(":")) {
    return isBlockedIpv6(ip);
  }
  return false;
}

/** Core validation: check a URL's host (after DNS resolution) against block lists. */
/** Resolve a URL's host via DNS and reject it if any resolved IP is private/reserved. */
export async function validateUrlHost(url: string): Promise<{ ok: boolean; reason?: string }> {
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
  if (!isAllowedPort(parsed.port, parsed.protocol)) {
    return { ok: false, reason: `Port ${parsed.port || "default"} is not allowed (only 80/443)` };
  }

  const hostname = parsed.hostname;
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: `Host "${hostname}" is reserved or internal` };
  }

  // Resolve hostname via DNS and check all resolved IPs
  try {
    const results = await dns.lookup(hostname, { all: true });
    for (const { address } of results) {
      if (isBlockedIp(address)) {
        return { ok: false, reason: `Resolved IP ${address} is a private/reserved address` };
      }
    }
  } catch {
    // If DNS fails, treat as potentially unsafe
    return { ok: false, reason: `Failed to resolve host "${hostname}"` };
  }

  return { ok: true };
}

/** URLs we can safely fetch — https, no credentials, public target (lexical check only, no DNS). */
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
  if (!isAllowedPort(parsed.port, parsed.protocol)) {
    return { ok: false, reason: `Port ${parsed.port || "default"} is not allowed (only 80/443)` };
  }

  const hostname = parsed.hostname;
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: `Host "${hostname}" is reserved or internal` };
  }

  // Raw-IP URLs (https://1.2.3.4/...) can be checked directly.
  const ipv4Literal = parseIpv4Literal(hostname);
  if (ipv4Literal) {
    if (isBlockedIpv4(ipv4Literal)) {
      return { ok: false, reason: `IP ${ipv4Literal} is a private/reserved address` };
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

/** Deterministically validate a URL (https-only, public hosts, lexical check only). */
export function validateFetchUrl(url: string): { ok: boolean; reason?: string } {
  return isSafeFetchUrl(url);
}

/** @deprecated Use validateFetchUrl. The allow_private opt-out has been removed; private/loopback is always blocked. */
export function validateFetchUrlInsecure(url: string): { ok: boolean; reason?: string } {
  return isSafeFetchUrl(url);
}

const webFetchTool: ToolDefinition = {
  name: "web_fetch",
  description: "Fetch a URL and return its content as text. Supports HTML pages, JSON APIs, and plain text. Only https on ports 80/443 to public hosts; private/loopback/link-local IPs are always blocked. Redirects are followed up to 3 hops with re-validation at each hop.",
  category: "web",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch (https only, public hosts, ports 80/443)." },
      max_length: { type: "number", description: "Max characters to return (default: 10000)." },
    },
    required: ["url"],
  },
  async execute(params): Promise<{ output: string; error?: string }> {
    let url = String(params.url ?? "");
    const maxLength = Number(params.max_length) || 10000;

    if (!url) {
      return { output: "", error: "URL is required." };
    }

    // Lexical validation first
    const lexical = isSafeFetchUrl(url);
    if (!lexical.ok) {
      return { output: "", error: `Blocked by SSRF guard: ${lexical.reason}` };
    }

    // Follow redirects manually with re-validation, max 3 hops
    const maxRedirects = 3;
    let redirectCount = 0;
    let finalResponse: Response | null = null;

    while (redirectCount <= maxRedirects) {
      // Full validation with DNS resolution at each hop
      const validated = await validateUrlHost(url);
      if (!validated.ok) {
        return { output: "", error: `Blocked by SSRF guard: ${validated.reason}` };
      }

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ZenoCli/1.0)",
          },
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });

        // Handle redirects manually
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            return { output: "", error: `Redirect without Location header: HTTP ${response.status}` };
          }
          // Resolve relative redirect URLs
          try {
            url = new URL(location, url).toString();
          } catch {
            return { output: "", error: `Invalid redirect URL: ${location}` };
          }
          redirectCount++;
          if (redirectCount > maxRedirects) {
            return { output: "", error: `Too many redirects (max ${maxRedirects})` };
          }
          continue;
        }

        finalResponse = response;
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { output: "", error: `Fetch failed: ${message}` };
      }
    }

    if (!finalResponse) {
      return { output: "", error: "Fetch failed: no response" };
    }

    if (!finalResponse.ok) {
      return { output: "", error: `Fetch failed: HTTP ${finalResponse.status}` };
    }

    const contentType = finalResponse.headers.get("content-type") ?? "";
    let text = await finalResponse.text();

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
  },
};

// ---- Export all definitions ----

export const searchToolDefinitions: ToolDefinition[] = [
  webSearchTool,
  webFetchTool,
];
