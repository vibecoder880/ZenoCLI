# Phase 2 — SSRF + DNS Rebinding Hardening

**Owner:** agent-b (module-dir ownership: `src/agent/tools/search.ts`)
**Blocked by:** Phase 1 committed first (clean base on `khanh`).
**Files agent-b MAY modify:** `src/agent/tools/search.ts`, `src/agent/tools/search-ssrf.test.ts`. No other files.

## Requirements

Current `validateFetchUrl`/`validateFetchUrlInsecure` (search.ts:179,184) block private/loopback/link-local/CGNAT IPv4, IPv6, reserved hostnames, https-only, credentials — but are **lexical only**. Hardening adds:

1. **IPv4-mapped IPv6** (`::ffff:1.2.3.4`) — normalize and run through the IPv4 block list (scout: currently not handled).
2. **Encoded/alternate IP literals** — hex (`0x7f000001`), octal (`0177.0.0.1`), decimal/integer (`2130706433`) forms used to defeat string checks → resolve to dotted-decimal and block.
3. **DNS re-resolution (rebinding defense)** — in `webFetchTool.execute`, before issuing the fetch, `dns.lookup(hostname)` and validate the resolved IP(s) against the block lists; not just the hostname string. Also validate each IP after resolution for the redirect chain.
4. **Redirect re-validation** — fetch with redirects disabled at the underlying level OR follow manually re-checking each hop against the block lists; cap redirect count (default 3). Simplify: use `redirect: "manual"` + re-validate Location header target with the same resolver, max 3 hops.
5. **Port/scheme allowlist** — for the fetch target, allow only 80/443 (and optionally known-safe ports), and https preferred; block exotic metadata ports post-3493 (scout notes port/fresh restrictions are missing).
6. **Remove `allow_private` param** from schema + implementation (user decision). Default/final behavior: private/loopback/link-local → blocked, always.

## Implementation steps

1. `search.ts`: add `import dns from "node:dns/promises"`. Add `normalizeIpLiteral(raw: string): string | null` (hex/octal/integer IPv4 variants → dotted decimal) and integrate into `isBlockedIpv4`. Add `isBlockedUrl(url, allowPrivate=false)` used by the whole chain.
2. Rewrite `webFetchTool` to: parse URL → scheme/port allowlist → resolve hostname via `dns.lookup` → run resolved IPs through block lists → `fetch(url, { redirect: "manual", signal })` → on `3xx`, re-parse Location, re-do guard, max 3 → final read with existing `max_length`.
3. Remove the `allow_private` JSON-schema property and `validateFetchUrlInsecure` path; `web_fetch` now single behavior. Keep `validateFetchUrlInsecure` export if a test or call site depends on it, but mark deprecated `@deprecated` and route it to the same hardened check (or drop if nothing imports it — verify with grep first).
4. Update the existing `search-ssrf.test.ts`: add
   - `::ffff:127.0.0.1`, `https://0x7f000001`, `https://2130706433`, `https://0177.0.0.1` → BLOCKED
   - `dns`-dependent redirect case: a public hostname in test redirecting to a private IP → BLOCKED (test with a real public URL or a mocked resolver — prefer a unit test on the guard function with a stubbed `dns.lookup`).
   - redirect-count > 3 → fails/blocked
   - non-80/443 port → BLOCKED
5. Local sanity: `npx vitest run src/agent/tools/search-ssrf.test.ts`.

## Tests / validation

- `search-ssrf.test.ts` (expanded) — 5 new cases + existing all still pass.
- CI (remote): full suite.

## Risks / rollback

- DNS resolver adds a network round-trip per web_fetch; acceptable (web_fetch already network-bound). Keep guard function pure/testable by injecting `lookup` fn.
- `redirect:"manual"` changes response handling: must read `location` header, not follow. Ensure 200 bodies still parsed as before.
- Hostname that resolves to *both* public and private (split DNS): block if any resolved IP is blocked (defense in depth over usability).
- If a legit metered-host case breaks, log; do not silently allow private.

## Acceptance

SSRF matrix from plan.md item 2 passes; no regression on existing legit public web_fetch cases; typecheck/lint clean on `search.ts`.

Status: DONE | DONE_WITH_CONCERNS | BLOCKED