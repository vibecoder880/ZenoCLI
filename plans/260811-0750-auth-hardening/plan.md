# Phase — Auth Hardening: PKCE + health check + auto refresh

**Date:** 2026-08-11 · **Branch:** `khanh` · **Slice:** roadmap priority 2 (plan §4.3 Phase A/B)

## Scope (chốt)

1. **PKCE (S256)** cho OAuth `authorization_code` flow — `code_verifier`/`code_challenge`,
   pure `node:crypto`, **không thêm dependency** (keytar/native excluded — YAGNI).
2. **`zeno auth health`** — validate credentials đã lưu (api_key present, oauth expiry + refresh, token).
3. **Auto token refresh** — OAuth profile refresh tự động khi sắp hết hạn (buffer mặc định 3 ngày),
   await nhưng không block event loop.

**Out of scope:** Device Code Flow, API-key vfunc `apiKeyHelper` (vault), SSO/SAML, keyring storage,
dynamic KNOWN_PROVIDERS registry.

## Files to modify

| File | Change |
|------|--------|
| `src/auth/oauth.ts` | `createPKCEVerifier()`, `createPKCEChallenge(verifier)`, `buildAuthorizationUrl(config, state, pkce?)`, `exchangeAuthorizationCode(config, code, codeVerifier?)` + postOAuthTokenRequest threads it |
| `src/cli/commands/auth.ts` | login path uses PKCE; add `zeno auth health` |
| `src/providers/shared.ts` | auto-refresh hook before resolving oauth access token |
| `src/auth/auth-profiles.ts` | helper `isOAuthProfileNearExpiry(profile, bufferMs)` |
| `src/index.ts` | register `auth health` |
| Tests | `oauth.test.ts`, `auth-profiles.test.ts`, `shared`/auth health |

## Non-negotiable constraints

- 3 providers vẫn chạy; ESM-only Node 22; TS strict; ESLint clean; no new dependency
- `buildAuthorizationUrl`/`exchangeAuthorizationCode` remain backward-compatible (PKCE optional param)
- No network in unit tests (mock `fetch` like oauth.test.ts already does)

## Implementation steps

1. PKCE helpers + wire into url builder + code exchange
2. `auth health` command
3. Auto-refresh in `resolveProviderSecret` / `getPreferredProfile`
4. Tests (mock fetch) + lint
5. Commit tiếng Anh → push → verify CI (windows+ubuntu)

## Tests / validation

- `oauth.test.ts`: challenge deterministic (SHA-256 of verifier, base64url), url contains
  `code_challenge`+`code_challenge_method=S256` when verifier passed, exchange body includes
  `code_verifier`
- `auth health` test: reports missing/unexpired profiles
- auto-refresh test: near-expiry profile triggers `refresh_token` grant (mocked fetch), far-expiry does not

## Risks / rollback

- PKCE: some providers reject when `code_challenge_method` present — Google/OpenAI support S256;
  fallback keeps existing non-PKCE path when verifier omitted → reversible per-call
- Auto-refresh in provider hot path: guarded by expiry buffer; failure → use stored token (degrade gracefully)