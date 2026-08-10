/**
 * Update Checker — check for updates trên launch.
 *
 * Reads version từ package.json, so sánh với npm registry.
 * Optional auto-notification.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const NPM_REGISTRY = "https://registry.npmjs.org/zeno-cli";
const CHECK_TIMEOUT = 5000;

export interface UpdateInfo {
  /** Current installed version. */
  current: string;
  /** Latest available version (null if unable to determine). */
  latest: string | null;
  /** Whether an update is available. */
  hasUpdate: boolean;
  /** Update notification message. */
  message: string;
}

/** Get current version from package.json. */
export function getCurrentVersion(): string {
  try {
    // Try relative to cwd first (when running from source)
    const localPkg = path.join(process.cwd(), "package.json");
    if (existsSync(localPkg)) {
      const pkg = JSON.parse(readFileSync(localPkg, "utf8")) as { version?: string };
      if (pkg.version) return pkg.version;
    }

    // Try to find the package.json from the module
    // For installed packages, this is in node_modules
    const modulePkg = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
      "..",
      "package.json",
    );
    if (existsSync(modulePkg)) {
      const pkg = JSON.parse(readFileSync(modulePkg, "utf8")) as { version?: string };
      if (pkg.version) return pkg.version;
    }
  } catch {
    // ignore
  }

  return "0.0.0";
}

/** Compare two semver versions. Returns true if `a` is older than `b`. */
export function isOlder(a: string, b: string): boolean {
  const parseVersion = (v: string): number[] => v.split(".").map((p) => Number(p.replace(/\D/g, "")) || 0);
  const [aMaj, aMin, aPat] = parseVersion(a);
  const [bMaj, bMin, bPat] = parseVersion(b);

  if (aMaj !== bMaj) return aMaj < bMaj;
  if (aMin !== bMin) return aMin < bMin;
  return aPat < bPat;
}

/** Check for updates by querying npm registry. */
export async function checkForUpdates(currentVersion: string = getCurrentVersion()): Promise<UpdateInfo> {
  try {
    const response = await fetch(NPM_REGISTRY, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT),
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      return {
        current: currentVersion,
        latest: null,
        hasUpdate: false,
        message: `Unable to check for updates (HTTP ${response.status})`,
      };
    }

    const data = await response.json() as { "dist-tags"?: { latest?: string } };
    const latest = data["dist-tags"]?.latest;

    if (!latest) {
      return {
        current: currentVersion,
        latest: null,
        hasUpdate: false,
        message: "Unable to determine latest version",
      };
    }

    const hasUpdate = isOlder(currentVersion, latest);

    return {
      current: currentVersion,
      latest,
      hasUpdate,
      message: hasUpdate
        ? `Update available: v${currentVersion} → v${latest}. Run: npm install -g zeno-cli@latest`
        : `You're on the latest version (v${currentVersion})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      current: currentVersion,
      latest: null,
      hasUpdate: false,
      message: `Update check failed: ${message}`,
    };
  }
}

/** Print update notification if available. */
export async function printUpdateNotification(): Promise<void> {
  const info = await checkForUpdates();
  if (info.hasUpdate) {
    process.stdout.write(`\n⚠️  ${info.message}\n\n`);
  }
}

// Cache path
export function getUpdateCheckCachePath(): string {
  return path.join(os.homedir(), ".zenocli", ".update-check");
}
