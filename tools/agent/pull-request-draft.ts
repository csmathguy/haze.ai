import { execFileSync } from "node:child_process";

import { buildPullRequestDraft } from "./lib/pull-request-draft.js";

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const files = options.files.length > 0 ? options.files : getChangedFiles(options);
  const draft = buildPullRequestDraft(files);
  const comparedAgainst = options.staged ? "staged changes" : options.base ?? "HEAD";

  process.stdout.write(`<!-- Compared against: ${comparedAgainst} -->\n\n`);
  process.stdout.write(`${draft.markdown}\n`);
}

interface ParsedArgs {
  base?: string;
  files: string[];
  staged: boolean;
}

function parseArgs(rawArgs: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    files: [],
    staged: false
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index];

    if (current === "--staged") {
      parsed.staged = true;
      continue;
    }

    if (current === "--base") {
      const base = rawArgs[index + 1];

      if (base === undefined) {
        throw new Error("Missing value after --base");
      }

      parsed.base = base;
      index += 1;
      continue;
    }

    if (current === undefined) {
      throw new Error("Unknown empty argument");
    }

    parsed.files.push(current);
  }

  return parsed;
}

function getChangedFiles(options: ParsedArgs): string[] {
  const gitArgs = options.staged ? ["diff", "--name-only", "--cached", "--diff-filter=ACMR"] : buildHeadDiffArgs(options.base);
  const stdout = execFileSync("git", gitArgs, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  return stdout
    .split(/\r?\n/gu)
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

function buildHeadDiffArgs(base?: string): string[] {
  if (base !== undefined) {
    return ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`];
  }

  try {
    execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: process.cwd(),
      stdio: "ignore"
    });

    return ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"];
  } catch {
    return ["diff", "--name-only", "--cached", "--diff-filter=ACMR"];
  }
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
