import { describe, expect, it, vi, beforeEach } from "vitest";
import dns from "node:dns/promises";
import { validateFetchUrl, validateFetchUrlInsecure, validateUrlHost } from "./search.js";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}));

describe("validateFetchUrl SSRF guard", () => {
  it("allows public https URLs", () => {
    expect(validateFetchUrl("https://example.com/page")).toEqual({ ok: true });
    expect(validateFetchUrl("https://api.example.com/v1/data?q=1")).toEqual({ ok: true });
    expect(validateFetchUrl("https://sub.example.co.uk:443/path")).toEqual({ ok: true });
  });

  it("blocks loopback and localhost", () => {
    expect(validateFetchUrl("http://localhost:9876/callback").ok).toBe(false);
    expect(validateFetchUrl("http://127.0.0.1/").ok).toBe(false);
    expect(validateFetchUrl("https://localhost/").ok).toBe(false);
    expect(validateFetchUrl("https://127.0.0.1:8080/").ok).toBe(false);
    expect(validateFetchUrl("https://[::1]/").ok).toBe(false);
  });

  it("blocks private and link-local IP ranges", () => {
    for (const ip of [
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "169.254.0.1",
      "0.0.0.0",
      "100.64.0.1", // CGNAT
    ]) {
      expect(validateFetchUrl(`https://${ip}/`).ok, `should block ${ip}`).toBe(false);
    }
  });

  it("blocks IPv6 loopback, ULA, and link-local", () => {
    expect(validateFetchUrl("https://[::1]/").ok).toBe(false);
    expect(validateFetchUrl("https://[fc00::1]/").ok).toBe(false);
    expect(validateFetchUrl("https://[fd12:3456::1]/").ok).toBe(false);
    expect(validateFetchUrl("https://[fe80::1]/").ok).toBe(false);
  });

  it("blocks reserved or internal hostnames", () => {
    expect(validateFetchUrl("https://metadata.google.internal/").ok).toBe(false);
    expect(validateFetchUrl("https://metadata.goog/").ok).toBe(false);
    expect(validateFetchUrl("https://db.internal/").ok).toBe(false);
    expect(validateFetchUrl("https://printer.local/").ok).toBe(false);
  });

  it("blocks non-https protocols", () => {
    expect(validateFetchUrl("http://example.com/").ok).toBe(false);
    expect(validateFetchUrl("ftp://example.com/").ok).toBe(false);
    expect(validateFetchUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateFetchUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("blocks embedded credentials", () => {
    expect(validateFetchUrl("https://user:pass@example.com/").ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(validateFetchUrl("not a url").ok).toBe(false);
    expect(validateFetchUrl("example.com").ok).toBe(false);
  });

  it("blocks non-80/443 ports", () => {
    expect(validateFetchUrl("https://example.com:8080/").ok).toBe(false);
    expect(validateFetchUrl("https://example.com:3000/").ok).toBe(false);
    expect(validateFetchUrl("https://example.com:8443/").ok).toBe(false);
    expect(validateFetchUrl("https://example.com:22/").ok).toBe(false);
  });

  // New: IPv4-mapped IPv6
  it("blocks IPv4-mapped IPv6 addresses (::ffff:1.2.3.4)", () => {
    expect(validateFetchUrl("https://[::ffff:127.0.0.1]/").ok).toBe(false);
    expect(validateFetchUrl("https://[::ffff:10.0.0.1]/").ok).toBe(false);
    expect(validateFetchUrl("https://[::ffff:192.168.1.1]/").ok).toBe(false);
    expect(validateFetchUrl("https://[::ffff:169.254.169.254]/").ok).toBe(false);
  });

  // New: Encoded/alternate IP literals
  it("blocks hex-encoded IPv4 literals (0x7f000001)", () => {
    expect(validateFetchUrl("https://0x7f000001/").ok).toBe(false); // 127.0.0.1
    expect(validateFetchUrl("https://0x0A000001/").ok).toBe(false); // 10.0.0.1
    expect(validateFetchUrl("https://0xC0A80101/").ok).toBe(false); // 192.168.1.1
  });

  it("blocks decimal/integer IPv4 literals (2130706433)", () => {
    expect(validateFetchUrl("https://2130706433/").ok).toBe(false); // 127.0.0.1
    expect(validateFetchUrl("https://167772161/").ok).toBe(false);  // 10.0.0.1
    expect(validateFetchUrl("https://3232235777/").ok).toBe(false); // 192.168.1.1
  });

  it("blocks octal-encoded IPv4 literals (0177.0.0.1)", () => {
    // Note: Node's URL parser already interprets leading zeros as octal
    // 0177 = 127 (loopback), 0300 = 192, 0250 = 168
    expect(validateFetchUrl("https://0177.0.0.1/").ok).toBe(false); // 127.0.0.1 (loopback)
    expect(validateFetchUrl("https://0300.0250.0.1/").ok).toBe(false); // 192.168.0.1 (private)
    // 010.0.0.1 = 8.0.0.1 (public), so it should be allowed
    expect(validateFetchUrl("https://010.0.0.1/").ok).toBe(true);
  });

  it("allow_private opt-out keeps protocol/credentials checks (deprecated)", () => {
    // The insecure validator now routes to the same hardened check
    expect(validateFetchUrlInsecure("https://localhost:9876/").ok).toBe(false);
    expect(validateFetchUrlInsecure("https://169.254.169.254/").ok).toBe(false);
    // …but http and credentials are still rejected.
    expect(validateFetchUrlInsecure("http://example.com/").ok).toBe(false);
    expect(validateFetchUrlInsecure("https://user:pass@example.com/").ok).toBe(false);
  });
});

describe("validateUrlHost DNS rebinding defense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks when DNS resolves to a private IP (DNS rebinding)", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 }, // attacker-controlled private second A record
    ]);
    const result = await validateUrlHost("https://public.example.com/");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/private\/reserved/);
  });

  it("allows when every resolved IP is public", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
    const result = await validateUrlHost("https://public.example.com/");
    expect(result.ok).toBe(true);
  });

  it("blocks unresolvable hostnames conservatively", async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error("ENOTFOUND"));
    const result = await validateUrlHost("https://nonesuch.invalid/");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Failed to resolve/);
  });
});