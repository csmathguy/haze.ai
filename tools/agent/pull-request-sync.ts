import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { AUDIT_ROOT, ensureAuditPaths, getActiveRunId, readSummary, type AuditSummary } from "./lib/audit.js";
import {
  buildPullRequestBody,
  collectValidationCommandsFromSummaries
} from "./lib/pull-request-publish.js";
import { buildPullRequestDraft } from "./lib/pull-request-draft.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const branch = getCurrentBranch();

  if (!options.privacyConfirmed) {
    throw new Error("Pass --privacy-confirmed after verifying that no private tax artifacts or sensitive logs are being published.");
  }

  ensurePublishableBranch(branch);
  ensureCleanWorktree();

  const compareRef = resolveCompareRef(options.base);
  const commitsAhead = getCommitCount(compareRef);

  if (commitsAhead === 0) {
    throw new Error(`No commits ahead of ${compareRef}. Commit the work before creating or updating a pull request.`);
  }

  const files = getChangedFiles(compareRef);
  const draft = buildPullRequestDraft(files);
  const title = options.title ?? options.summary;
  const body = buildPullRequestBody({
    draft,
    privacyConfirmed: options.privacyConfirmed,
    summary: options.summary,
    validationCommands: collectValidationCommandsFromSummaries(
      options.dryRun ? await resolveValidationSummaries(options.workflow) : await pushAndResolveValidationSummaries(branch, options.workflow)
    ),
    value: options.value
  });

  if (options.dryRun) {
    process.stdout.write(`${title}\n\n${body}\n`);
    return;
  }

  const openPullRequest = findOpenPullRequest(branch);
  const bodyPath = path.resolve("artifacts", "pull-request-sync-body.md");

  await writeFile(bodyPath, `${body}\n`, "utf8");

  if (openPullRequest === null) {
    const createdUrl = runGh([
      "pr",
      "create",
      "--base",
      options.base,
      "--head",
      branch,
      "--title",
      title,
      "--body-file",
      bodyPath,
      ...(options.draft ? ["--draft"] : [])
    ]);

    process.stdout.write(`${createdUrl.trim()}\n`);
    return;
  }

  runGh([
    "pr",
    "edit",
    String(openPullRequest.number),
    "--title",
    title,
    "--body-file",
    bodyPath
  ]);
  process.stdout.write(`${openPullRequest.url}\n`);
}

interface ParsedArgs {
  base: string;
  draft: boolean;
  dryRun: boolean;
  privacyConfirmed: boolean;
  summary: string;
  title?: string;
  value: string;
  workflow: string;
}

function parseArgs(rawArgs: string[]): ParsedArgs {
  const parsed: Partial<ParsedArgs> = {
    base: "main",
    draft: false,
    dryRun: false,
    privacyConfirmed: false,
    workflow: "implementation"
  };

  let index = 0;

  while (index < rawArgs.length) {
    index = consumeArgument(parsed, rawArgs, index) + 1;
  }

  return finalizeParsedArgs(parsed);
}

function consumeArgument(parsed: Partial<ParsedArgs>, rawArgs: string[], index: number): number {
  const current = rawArgs[index];

  if (isBooleanFlag(current)) {
    assignBooleanArg(parsed, current);
    return index;
  }

  if (isStringFlag(current)) {
    const value = rawArgs[index + 1];

    if (value === undefined) {
      throw new Error(`Missing value after ${current}`);
    }

    assignStringArg(parsed, current, value);
    return index + 1;
  }

  throw new Error(`Unknown argument: ${current ?? "<empty>"}`);
}

function finalizeParsedArgs(parsed: Partial<ParsedArgs>): ParsedArgs {
  if (parsed.summary === undefined || parsed.value === undefined || parsed.base === undefined || parsed.workflow === undefined) {
    throw new Error("Expected --summary, --value, --base, and --workflow.");
  }

  return {
    base: parsed.base,
    draft: parsed.draft ?? false,
    dryRun: parsed.dryRun ?? false,
    privacyConfirmed: parsed.privacyConfirmed ?? false,
    summary: parsed.summary,
    value: parsed.value,
    workflow: parsed.workflow,
    ...(parsed.title === undefined ? {} : { title: parsed.title })
  };
}

function isBooleanFlag(value: string | undefined): value is "--draft" | "--dry-run" | "--privacy-confirmed" {
  return value === "--draft" || value === "--dry-run" || value === "--privacy-confirmed";
}

function assignBooleanArg(
  parsed: Partial<ParsedArgs>,
  key: "--draft" | "--dry-run" | "--privacy-confirmed"
): void {
  switch (key) {
    case "--draft":
      parsed.draft = true;
      break;
    case "--dry-run":
      parsed.dryRun = true;
      break;
    case "--privacy-confirmed":
      parsed.privacyConfirmed = true;
      break;
  }
}

function isStringFlag(
  value: string | undefined
): value is "--base" | "--summary" | "--title" | "--value" | "--workflow" {
  return (
    value === "--base" ||
    value === "--summary" ||
    value === "--title" ||
    value === "--value" ||
    value === "--workflow"
  );
}

function assignStringArg(parsed: Partial<ParsedArgs>, key: string, value: string): void {
  switch (key) {
    case "--base":
      parsed.base = value;
      break;
    case "--summary":
      parsed.summary = value;
      break;
    case "--title":
      parsed.title = value;
      break;
    case "--value":
      parsed.value = value;
      break;
    case "--workflow":
      parsed.workflow = value;
      break;
    default:
      throw new Error(`Unknown argument: ${key}`);
  }
}

function getCurrentBranch(): string {
  return runGit(["branch", "--show-current"]).trim();
}

function ensurePublishableBranch(branch: string): void {
  if (branch.length === 0 || branch === "HEAD") {
    throw new Error("Pull request sync requires a named branch, not a detached HEAD.");
  }

  if (branch === "main") {
    throw new Error("Pull request sync requires a feature branch, not main.");
  }
}

function ensureCleanWorktree(): void {
  const status = runGit(["status", "--porcelain"]).trim();

  if (status.length > 0) {
    throw new Error("Pull request sync requires a clean worktree. Create atomic commits before syncing the PR.");
  }
}

function resolveCompareRef(baseBranch: string): string {
  try {
    runGit(["rev-parse", "--verify", `origin/${baseBranch}`], "ignore");
    return `origin/${baseBranch}`;
  } catch {
    return baseBranch;
  }
}

function getCommitCount(compareRef: string): number {
  return Number(runGit(["rev-list", "--count", `${compareRef}..HEAD`]).trim());
}

function getChangedFiles(compareRef: string): string[] {
  const stdout = runGit(["diff", "--name-only", "--diff-filter=ACMR", `${compareRef}...HEAD`]);

  return stdout
    .split(/\r?\n/gu)
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

function pushBranch(branch: string): void {
  execFileSync("git", ["push", "-u", "origin", branch], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
}

function findOpenPullRequest(branch: string): { number: number; url: string } | null {
  const stdout = runGh(["pr", "list", "--state", "open", "--head", branch, "--json", "number,url"]);
  const pullRequests = JSON.parse(stdout) as { number: number; url: string }[];

  return pullRequests[0] ?? null;
}

async function resolveValidationSummaries(workflow: string): Promise<Pick<AuditSummary, "steps">[]> {
  const summaries: Pick<AuditSummary, "steps">[] = [];

  for (const candidateWorkflow of getValidationWorkflowNames(workflow)) {
    const summary = await resolveWorkflowSummary(candidateWorkflow);

    if (summary !== null) {
      summaries.push(summary);
    }
  }

  return summaries;
}

async function pushAndResolveValidationSummaries(
  branch: string,
  workflow: string
): Promise<Pick<AuditSummary, "steps">[]> {
  pushBranch(branch);
  return resolveValidationSummaries(workflow);
}

function getValidationWorkflowNames(primaryWorkflow: string): string[] {
  return [...new Set([primaryWorkflow, "changed-quality", "pre-commit", "pre-push"])];
}

async function resolveWorkflowSummary(workflow: string): Promise<Pick<AuditSummary, "steps"> | null> {
  const activeRunId = await getActiveRunId(workflow);

  if (activeRunId !== null) {
    const activePaths = await ensureAuditPaths(activeRunId);
    const activeSummary = await readSummary(activePaths);

    if (activeSummary !== null) {
      return activeSummary;
    }
  }

  return findLatestWorkflowSummary(workflow);
}

async function findLatestWorkflowSummary(workflow: string): Promise<Pick<AuditSummary, "steps"> | null> {
  const summaryPaths = await collectSummaryPaths(AUDIT_ROOT);
  let latestSummary: AuditSummary | null = null;

  for (const summaryPath of summaryPaths) {
    const contents = await readFile(summaryPath, "utf8");
    const summary = JSON.parse(contents) as AuditSummary;

    if (summary.cwd !== process.cwd() || summary.workflow !== workflow) {
      continue;
    }

    if (latestSummary === null || Date.parse(summary.startedAt) > Date.parse(latestSummary.startedAt)) {
      latestSummary = summary;
    }
  }

  return latestSummary;
}

async function collectSummaryPaths(root: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(root, {
      recursive: true,
      withFileTypes: true
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name === "summary.json")
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function runGit(args: string[], stdio: "ignore" | "pipe" = "pipe"): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio
  });
}

function runGh(args: string[]): string {
  return execFileSync("gh", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
