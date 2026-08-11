---
phase: 4
title: "Device Code Flow"
status: pending
priority: P1
dependencies: []
---

# Phase 4: Device Code Flow (OAuth)

## Overview
Add Device Code Flow so OAuth login works in headless environments (WSL2, SSH,
Docker, CI) where a browser cannot reach `localhost` for the redirect callback.
User pastes the device code at a verification URL instead.

## Requirements
- Functional: `zeno auth login <provider> --method oauth --device` performs the
  device flow: POST device authorization endpoint → show `user_code` + URL →
  poll token endpoint → save profile.
- Functional: falls back to device flow automatically when localhost callback
  is unavailable (optional flag or auto-detect).
- Non-functional: no new dependency; uses `fetch` (Node 22). Provider support
  gated by provider config (Google/OpenAI device endpoints).

## Architecture
Add `src/auth/device-code.ts` with:
- `startDeviceFlow(config)`: POST `{tokenUrl-or-deviceUrl}` → `{device_code, user_code, verification_uri, expires_in, interval}`.
- `pollForDeviceToken(config, deviceCode, interval)`: poll until token or expiry.
- A `--device` flag on `zeno auth login`; when set, skip the localhost callback
  path and use the device flow instead. Save via existing `AuthProfileStore`.

## Related Code Files
- Create: `src/auth/device-code.ts` + `src/auth/device-code.test.ts`
- Modify: `src/auth/oauth.ts` — extend `OAuthProviderConfig` with optional
  `deviceUrl`; add `getDeviceConfig()` for google/openai
- Modify: `src/cli/commands/auth.ts` — `--device` flag on login
- Modify: `docs/architecture.md` — document device flow

## Implementation Steps
1. Extend `OAuthProviderConfig` with `deviceUrl?`; add device endpoints for
   google (`https://oauth2.googleapis.com/device/code`) and openai (config env).
2. `startDeviceFlow` / `pollForDeviceToken` with polling + expiry handling.
3. Wire `--device` flag into login command; show user_code + verification_uri.
4. On token received, reuse `exchangeAuthorizationCode` result shape → saveProfile.
5. Test (mock fetch): start flow returns codes, poll returns token.

## Success Criteria
- [ ] `zeno auth login google --method oauth --device` shows device code + URL
- [ ] Polling exchanges device_code for tokens and saves the profile
- [ ] Fails gracefully on expiry/denied with clear message
- [ ] CI green

## Risk Assessment
- Provider device endpoints vary; gate by config + clear "unsupported" error.
- Polling interval must respect `interval` + `expires_in`.
