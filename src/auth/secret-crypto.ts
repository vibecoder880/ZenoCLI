/**
 * Static-at-rest encryption for stored auth secrets.
 *
 * A machine-local key file (~/.zenocli/.secret, created 0600) feeds a
 * SHA-256 derivation to produce a 32-byte AES-256-GCM key. Each secret is
 * encrypted to a self-describing envelope `v1.<nonceB64>.<tagB64>.<cipherB64>`
 * so nonce and auth tag travel with the ciphertext; no plaintext secret is
 * ever written to auth-profiles.json.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ensureAppDataDirectory } from "../storage/paths.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Read the machine key, creating it (0600) on first use. */
export function getMachineKey(): Buffer {
  const secretsDir = ensureAppDataDirectory();
  const keyPath = path.join(secretsDir, ".secret");

  if (!existsSync(keyPath)) {
    const secret = randomBytes(32).toString("hex");
    writeFileSync(keyPath, secret, { mode: 0o600 });
    return deriveKey(secret);
  }

  const raw = readFileSync(keyPath, "utf8").trim();
  return deriveKey(raw);
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypt a secret string into a versioned envelope. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getMachineKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

/**
 * Decrypt a versioned envelope back to plaintext. Returns null when the
 * value is not an envelope (e.g. a legacy plaintext secret or a value that
 * was never encrypted) so callers can tolerate old files.
 */
export function decryptSecret(envelope: string): string | null {
  if (!envelope || typeof envelope !== "string") {
    return null;
  }

  const parts = envelope.split(".");
  if (parts[0] !== "v1") {
    return null; // Not an encryption envelope — treat as legacy plaintext.
  }

  try {
    const [, ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64 ?? "", "base64");
    const tag = Buffer.from(tagB64 ?? "", "base64");
    const data = Buffer.from(dataB64 ?? "", "base64");

    const decipher = createDecipheriv(ALGORITHM, getMachineKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // Wrong machine key or tampered data — surface as undecryptable.
    return null;
  }
}

/** True when a value looks like an encryption envelope. */
export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith("v1.");
}