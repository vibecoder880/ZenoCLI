import { describe, expect, it } from "vitest";
import { validateFetchUrl, validateFetchUrlInsecure } from "./search.js";

describe("validateFetchUrl SSRF guard", () => {
  it("allows public https URLs", () => {
    expect(validateFetchUrl("https://example.com/page")).toEqual({ ok: true });
    expect(validateFetchUrl("https://api.example.com/v1/data?q=1")).toEqual({ ok: true });
    expect(validateFetchUrl("https://sub.example.co.uk:8443/path")).toEqual({ ok: true });
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

  it("allow_private opt-out keeps protocol/credentials checks", () => {
    // loopback is permitted by the insecure validator…
    expect(validateFetchUrlInsecure("https://localhost:9876/")).toEqual({ ok: true });
    expect(validateFetchUrlInsecure("https://169.254.169.254/")).toEqual({ ok: true });
    // …but http and credentials are still rejected.
    expect(validateFetchUrlInsecure("http://example.com/").ok).toBe(false);
    expect(validateFetchUrlInsecure("https://user:pass@example.com/").ok).toBe(false);
  });
});