import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AuthProfileStore, isProfileExpired } from "./auth-profiles.js";
import { encryptSecret, decryptSecret, isEncrypted } from "./secret-crypto.js";

const tempHome = path.join(os.tmpdir(), `.zeno-test-home-${Date.now()}`);

describe("AuthProfileStore", () => {
  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("saves and retrieves the active profile", () => {
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("USERPROFILE", tempHome);
    const store = new AuthProfileStore();

    const saved = store.saveProfile({
      type: "api_key",
      provider: "openai",
      key: "sk-test-123456789",
      label: "default"
    });

    expect(store.getActiveProfile("openai")?.id).toBe(saved.id);
  });

  it("stores secrets encrypted at rest and decrypts on load", () => {
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("USERPROFILE", tempHome);
    const store = new AuthProfileStore();

    store.saveProfile({
      type: "api_key",
      provider: "openai",
      key: "sk-very-secret-12345",
      label: "default"
    });

    // Raw file must not contain the plaintext secret.
    const raw = readFileSync(path.join(tempHome, ".zenocli", "auth-profiles.json"), "utf8");
    expect(raw).not.toContain("sk-very-secret-12345");

    // Decrypted read returns the original secret.
    const loaded = store.listProfiles("openai");
    expect(loaded).toHaveLength(1);
    expect(loaded[0].type === "api_key" && loaded[0].key).toBe("sk-very-secret-12345");
  });

  it("round-trips the encryption helpers", () => {
    const secret = "access-token-abc";
    const envelope = encryptSecret(secret);
    expect(isEncrypted(envelope)).toBe(true);
    expect(envelope).not.toContain(secret);
    expect(decryptSecret(envelope)).toBe(secret);
    expect(decryptSecret("plaintext")).toBeNull();
  });

  it("marks expired oauth profiles as expired", () => {
    const now = Date.now();
    expect(
      isProfileExpired({
        id: "google:test",
        type: "oauth",
        provider: "google",
        access: "access",
        refresh: "refresh",
        expires: now - 1,
        createdAt: now,
        updatedAt: now
      })
    ).toBe(true);
  });
});
