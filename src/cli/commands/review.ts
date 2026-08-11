/**
 * Code review command — `zeno review <target>`.
 *
 * Runs the reviewer subagent (read-only + run_command, reviewer persona from
 * src/agents/reviewer.md) over a file/dir or a git diff, emitting findings via
 * the same headless output path as `zeno chat`/`zeno agent`. In headless mode
 * the exit code reflects the highest-severity finding so it can gate a PR.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnTypedSubagent } from "../../agent/subagent.js";
import { AuthProfileStore } from "../../auth/auth-profiles.js";
import { refreshOAuthIfNeeded } from "../../auth/refresh.js";
import { createProvider } from "../../providers/index.js";
import { selectUsableRoute } from "../../providers/router-fallback.js";
import { loadConfig } from "../../storage/config.js";
import { resolveMetadataModel } from "../../providers/router.js";
import { installSigintAbort } from "../sigint.js";

export interface ReviewOptions {
  target?: string;
  diff?: string;
  cwd: string;
  nonInteractive?: boolean;
  signal?: AbortSignal;
}

/** Collect changed file paths for a git ref (e.g. "HEAD~1" or "HEAD"). */
function collectDiffFiles(cwd: string, ref: string): string[] {
  try {
    const output = execFileSync("git", ["diff", "--name-only", ref], { cwd, encoding: "utf8" });
    return output.split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    throw new Error(`Could not collect changed files for "${ref}". Is this a git repository?`);
  }
}

/** Resolve the review target to a task description + context. */
function buildTask(cwd: string, target: string | undefined, diff: string | undefined): string {
  if (diff) {
    const files = collectDiffFiles(cwd, diff);
    const fileList = files.length > 0 ? files.join("\n") : "(no changed files)";
    return [
      "You are a code reviewer. Review the following changed files (git diff):",
      "",
      fileList,
      "",
      "For each file, identify bugs, security issues, edge cases, and style violations.",
      "Use `git diff <ref>` to inspect the actual changes.",
      "Report issues by severity: Critical (bugs/security), Major (significant), Minor (style).",
    ].join("\n");
  }

  if (target) {
    const resolved = path.resolve(target);
    if (!existsSync(resolved)) {
      throw new Error(`Review target not found: ${target}`);
    }
    return [
      `Review the code at ${resolved}.`,
      "Identify bugs, security issues, edge cases, and style violations.",
      "Report issues by severity: Critical (bugs/security), Major (significant), Minor (style).",
    ].join("\n");
  }

  return "Review the current working directory for bugs, security issues, and style violations.";
}

/** Map the strongest severity keyword in the output to an exit code (0 clean, 1 findings). */
export function severityExitCode(output: string): number {
  const lower = output.toLowerCase();
  if (/\b(critical|security|data loss)\b/.test(lower)) {
    return 1;
  }
  if (/\b(major|bug)\b/.test(lower)) {
    return 1;
  }
  return 0;
}

export async function runReviewCommand(options: ReviewOptions): Promise<void> {
  const signal = options.signal ?? (options.nonInteractive ? installSigintAbort() : undefined);

  const config = loadConfig();
  const selection = selectUsableRoute(config, undefined, undefined, undefined);
  const route = selection.route;

  await refreshOAuthIfNeeded(new AuthProfileStore(), route.provider);
  const provider = createProvider(route.provider);

  const task = buildTask(options.cwd, options.target, options.diff);

  if (!options.nonInteractive) {
    process.stdout.write(`Reviewing${options.target ? ` ${options.target}` : options.diff ? ` (diff ${options.diff})` : " cwd"} using ${route.provider}/${route.model}\n`);
  }

  const result = await spawnTypedSubagent("reviewer", {
    task,
    provider,
    model: resolveMetadataModel(config),
    cwd: options.cwd,
    signal,
  });

  const output = result.output;
  if (options.nonInteractive) {
    // Headless: print the summary to stdout; errors to stderr.
    process.stdout.write(`${output}\n`);
    if (!result.success) {
      process.stderr.write(`[review] ${result.error ?? "review failed"}\n`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = severityExitCode(output);
    return;
  }

  process.stdout.write(`\n${output}\n`);
  if (!result.success) {
    process.stdout.write(`\nReview failed: ${result.error ?? "unknown error"}\n`);
  }
}
