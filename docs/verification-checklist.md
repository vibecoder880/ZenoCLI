# Verification Checklist

## Automated coverage

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm pack --dry-run`
- `npm run prepare:release-notes`
- `npm run release:package`

## Automated feature coverage

- Slash command filtering and exact command lookup
- Auth profile storage, expiry detection, and OAuth refresh request flow
- Config file persistence and updates
- Context file initialization and updates
- History persistence, lookup, and clearing
- Cost estimation
- Model routing and fallback selection

## Manual checks still required

- TUI interactive flow in a real terminal session
- Chat responses against OpenAI with a real API key
- Chat responses against Anthropic with a real API key
- Chat responses against Google with a real API key
- Google OAuth login with real OAuth client credentials
- OpenAI OAuth login with real OAuth client credentials
- `auth refresh` against a real OAuth refresh token
- Agent loop on a real code task with at least one configured provider
- GitHub Actions release execution on the latest tag
- npm publish execution with a valid `NPM_TOKEN`

## Release gate

Ship a final release only after:

1. all automated checks pass
2. the manual credential-gated checks above are completed
3. the release workflow succeeds for the target tag
4. npm publish succeeds for `zeno-cli`
