# Changelog

## 0.2.0 - 2026-04-02

- Rename the npm package to `neuro-cli` and prepare it for global installation with `npm install -g neuro-cli`.
- Add a clean CLI/TUI foundation with chat, agent, auth, history, cost, config, context, health, and model discovery commands.
- Add provider routing plus adapters for OpenAI, Anthropic, and Google.
- Add local auth profile storage with API key support and configurable OAuth login flows for Google and OpenAI.
- Add local session history and tracked token usage.
- Add project-level context support through `NEURO.md`.
- Add GitHub Actions packaging for Windows and Linux plus GitHub Release publishing.
- Prepare npm publishing automation for tagged releases when `NPM_TOKEN` is configured.
