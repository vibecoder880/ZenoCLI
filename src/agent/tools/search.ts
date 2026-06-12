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
          "User-Agent": "Mozilla/5.0 (compatible; NeuroCli/1.0)",
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

const webFetchTool: ToolDefinition = {
  name: "web_fetch",
  description: "Fetch a URL and return its content as text. Supports HTML pages, JSON APIs, and plain text.",
  category: "web",
  safety: "safe",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch." },
      max_length: { type: "number", description: "Max characters to return (default: 10000)." },
    },
    required: ["url"],
  },
  async execute(params): Promise<{ output: string; error?: string }> {
    const url = String(params.url ?? "");
    const maxLength = Number(params.max_length) || 10000;

    if (!url) {
      return { output: "", error: "URL is required." };
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NeuroCli/1.0)",
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
