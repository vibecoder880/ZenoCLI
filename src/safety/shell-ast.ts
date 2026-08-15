/**
 * Command Safety v2 — lightweight shell-structure parser + risk analysis.
 *
 * The previous model was two divergent regex denylists (one in
 * `tools/exec.ts`, one in this module's predecessor). Regex is not a
 * security boundary, but it also cannot be the *only* tool: the real
 * boundary is the OS sandbox. This module provides a single, shared
 * analysis that both `run_command` and the auto-mode classifier consume,
 * so the rules can never drift apart.
 *
 * Design: a best-effort tokenizer that understands statement/pipeline
 * boundaries (not a full POSIX grammar — KISS), then a risk score per the
 * roadmap scoring table. Blocked = risk bucket "high" plus a curated list
 * of concrete destructive shapes. Conservative by construction: when the
 * parser does not understand something, it falls back to a safe default
 * (treat as medium risk, not blocked) — a missed block is bounded by the
 * sandbox, a false positive breaks a legitimate command.
 */

// ---- Risk scoring (plan section D2) ----

export const RISK: Record<string, number> = {
  READ_ONLY: 0,
  WORKSPACE_WRITE: 1,
  NETWORK: 2,
  PROCESS_SPAWN: 3,
  PRIVILEGED: 5,
  SECRET_ACCESS: 6,
  DESTRUCTIVE: 8,
  UNSANDBOXED: 10,
};

export type RiskLevel = "low" | "medium" | "high";

export interface CommandAnalysis {
  /** Overall risk bucket. */
  risk: RiskLevel;
  /** Whether the command must be refused outright. */
  blocked: boolean;
  /** Human-readable reasons for the verdict (empty when benign). */
  reasons: string[];
  /** Parsed structure (best-effort). */
  statements: ShellStatement[];
}

export interface ShellStatement {
  /** Individual command/segment within a pipeline or `&&`/`||` chain. */
  commands: string[];
  /** Redirection targets found in this statement. */
  redirects: string[];
  /** Whether a command substitution `$(...)`/backtick was detected. */
  hasSubstitution: boolean;
  /** Whether a subshell `( ... )` was detected. */
  hasSubshell: boolean;
  /** Whether a heredoc marker was detected. */
  hasHeredoc: boolean;
}

const STATEMENT_SEPARATORS = /\|\||&&|;/;

/**
 * Lightweight shell tokenizer: split a command into statements on `|` and
 * `;` (pipeline/list boundaries) while keeping quotes and `&&`/`||` chains
 * within one statement (its `commands[]` holds the chained parts). Best-
 * effort — does not parse nested quotes inside command substitution.
 */
export function parseShellStatements(command: string): ShellStatement[] {
  const statements: ShellStatement[] = [];
  const segments = splitRespectingQuotes(command, "|;", "");
  for (const raw of segments) {
    const segment = raw.trim();
    if (!segment) continue;
    const commands = segment
      .split(/\s*(?:&&|\|\|)\s*/)
      .map((c) => c.trim())
      .filter(Boolean);
    const redirects: string[] = [];
    const redirectRe = /(?:^|\s)(?:>|>>|<|2>)\s*([^\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = redirectRe.exec(segment)) !== null) {
      redirects.push(m[1]);
    }
    statements.push({
      commands,
      redirects,
      hasSubstitution: /(\$\(|`)/.test(segment),
      hasSubshell: /\(\s*[^)]*\)/.test(segment),
      hasHeredoc: /<<[-]?[\w"]+/.test(segment),
    });
  }
  return statements;
}

/** Split on a separator while keeping quoted sections whole. */
function splitRespectingQuotes(input: string, seps: string, _extraSep: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if ((ch === '"' || ch === "'") && quote === null) {
      quote = ch;
      current += ch;
    } else if (ch === quote && quote !== null) {
      quote = null;
      current += ch;
    } else if (quote === null && seps.includes(ch)) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
    i++;
  }
  parts.push(current);
  return parts;
}

// ---- Curated destructive shapes (merged from exec.ts + classifier.ts) ----

const DANGEROUS_TARGET_TOKENS = [/\*/i, /^\.$/, /^~/i, /\$/, /\.\.\//, /^\/+/];

const INTERPRETERS = /\b(sh|bash|zsh|dash|python|python3|perl|ruby|php|node|nodejs|powershell|pwsh)\s+(-c|-e|--%C|--command)\b/i;

interface Rule {
  pattern: RegExp;
  reason: string;
}

const BLOCK_RULES: Rule[] = [
  { pattern: /\bgit\s+(?:push|fetch|pull)\s+.*--force(?:-with-lease)?/i, reason: "Force push/pull to a git remote is blocked" },
  { pattern: /\bgit\s+reset\s+--hard\s+(?:origin\/|\/)/, reason: "Hard reset to a remote ref is blocked" },
  { pattern: /\bformat\s+[a-z]:/i, reason: "Drive formatting is blocked" },
  { pattern: /\bdd\s+if=/i, reason: "Low-level disk writes via dd are blocked" },
  { pattern: /\bshutdown|reboot|poweroff\b/i, reason: "System power commands are blocked" },
  { pattern: /\bkill\s+-9\s+1\b/i, reason: "Killing PID 1 is blocked" },
  { pattern: /\bdocker\s+rm\s+-f\s+/i, reason: "Force container removal is blocked" },
  { pattern: /\bnpm\s+uninstall|npm\s+remove|yarn\s+remove|pnpm\s+remove\b/, reason: "Package removal is blocked" },
  { pattern: /\bnpm\s+publish\b/, reason: "npm publish is blocked" },
  { pattern: /\b(apt|yum|brew)\s+remove/i, reason: "Package removal requires approval" },
  { pattern: /\bchmod\s+-R\s+777/i, reason: "Recursive chmod 777 is blocked" },
  { pattern: /\bdel\s+\/[sfq]+\s+[a-zA-Z]:\\/i, reason: "Windows recursive delete is blocked" },
  { pattern: /\brmdir\s+\/[sq]+\s+[a-zA-Z]:\\/i, reason: "Windows recursive delete is blocked" },
  { pattern: /\bcurl\s+.*(-d|--data|--data-raw|-X\s+POST|-X\s+PUT|-X\s+PATCH)/i, reason: "Sending data via curl is blocked" },
  { pattern: /\bwget\s+.*--post/i, reason: "Sending data via wget is blocked" },
  { pattern: /\bcurl\s+.*\|\s*(?:ba)?sh/i, reason: "Piping curl output to a shell is blocked" },
  { pattern: /\bwget\s+.*\|\s*(?:ba)?sh/i, reason: "Piping wget output to a shell is blocked" },
];

const SEND_DATA_RE = /\bcurl\s+.*(-d|--data|--data-raw|-X\s+POST|-X\s+PUT|-X\s+PATCH)/i;
const SEND_DATA_WGET_RE = /\bwget\s+.*--post/i;

const DELETE_COMMANDS = new Set(["rm", "unlink", "rmdir", "del"]);

/** Tokenize a shell command on whitespace, keeping quoted segments in place. */
export function tokenize(command: string): string[] {
  const tokens: string[] = [];
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  for (const part of parts) {
    const stripped = part.startsWith('"') && part.endsWith('"')
      ? part.slice(1, -1)
      : part.startsWith("'") && part.endsWith("'")
        ? part.slice(1, -1)
        : part;
    tokens.push(stripped);
  }
  return tokens;
}

/**
 * Analyze a shell command for risk. Blocked => the command should be refused.
 * The verdict is derived from (a) curated destructive shapes that regex can
 * express reliably, and (b) the structural parser for recursive deletes and
 * interpreter one-liners.
 */
export function analyzeCommand(command: string): CommandAnalysis {
  const reasons: string[] = [];
  const lower = command.toLowerCase();
  let score = RISK.READ_ONLY;

  const statements = parseShellStatements(command);

  // 1. Whole-command destructive / exfiltration / privileged shapes.
  for (const rule of BLOCK_RULES) {
    if (rule.pattern.test(command)) {
      reasons.push(rule.reason);
      score = Math.max(score, RISK.DESTRUCTIVE);
    }
  }

  // 2. Network + spawn already imply non-read-only work.
  if (/\b(curl|wget|nc|ncat|ssh|scp|rsync)\b/i.test(command)) {
    score = Math.max(score, RISK.NETWORK);
  }

  // 3. Recursive/force delete targets via the tokenizer.
  const tokens = tokenize(command);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();
    if (!DELETE_COMMANDS.has(token)) continue;
    let targetIndex = i + 1;
    while (tokens[targetIndex]?.startsWith("-")) targetIndex++;
    const flags = tokens.slice(i + 1, targetIndex).join("").toLowerCase();
    const isRecursive = flags.includes("r");
    const isForce = flags.includes("f");
    if (!isRecursive && !isForce) continue;
    const target = tokens[targetIndex];
    if (!target) continue;
    const targetDangerous = DANGEROUS_TARGET_TOKENS.some((re) => re.test(target));
    if (isRecursive && targetDangerous) {
      reasons.push(`recursive delete of unsafe target "${target}" is blocked`);
      score = Math.max(score, RISK.DESTRUCTIVE);
    }
  }

  // 4. Interpreter one-liners that can wrap arbitrary system calls.
  const interpMatch = command.match(INTERPRETERS);
  if (interpMatch) {
    const hiddenDestructive =
      /\b(system|popen|exec(?:vp|ve|l|le)?|unlink|remove|rmtree|mkdir_?tree|shutil\.)\b/.test(lower)
      || /\brm\b/.test(lower)
      || /\bdel\b/.test(lower)
      || /(os\.|subprocess\.|child_process\.|fs\.)?\s*(unlink|rm|rmtree|remove)|\bos\.system\b/.test(lower)
      || /file:\/\//i.test(lower);
    if (hiddenDestructive) {
      reasons.push("interpreter one-liner that may perform destructive operations is blocked");
      score = Math.max(score, RISK.DESTRUCTIVE);
    }
  }

  // 5. Send-data exfiltration (kept as a distinct score contribution).
  if (SEND_DATA_RE.test(command) || SEND_DATA_WGET_RE.test(command)) {
    score = Math.max(score, RISK.NETWORK + RISK.WORKSPACE_WRITE);
  }

  // 6. Any redirection is a workspace mutation; redirects into system paths
  // (`> /etc/...`) are privileged and blocked.
  for (const stmt of statements) {
    for (const redirect of stmt.redirects) {
      score = Math.max(score, RISK.WORKSPACE_WRITE);
      if (redirect.startsWith("/") && !redirect.startsWith("/tmp") && !redirect.startsWith("/dev/null")) {
        reasons.push(`redirect into "${redirect}" is blocked`);
        score = Math.max(score, RISK.DESTRUCTIVE);
      }
    }
  }

  const blocked = score >= RISK.DESTRUCTIVE && reasons.length > 0;
  const risk: RiskLevel = score >= RISK.DESTRUCTIVE ? "high" : score >= RISK.PROCESS_SPAWN ? "medium" : score >= RISK.WORKSPACE_WRITE ? "medium" : "low";

  return { risk, blocked, reasons, statements };
}
