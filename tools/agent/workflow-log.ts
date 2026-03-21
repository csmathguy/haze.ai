import { execFileSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import {
  appendAuditEvent,
  clearActiveRun,
  createEvent,
  createRunId,
  createWorkflowSummary,
  ensureAuditPaths,
  getEventContextFields,
  getActiveRunId,
  readSummary,
  setActiveRun,
  type AuditRunContextFields,
  writeSummary
} from "./lib/audit.js";
import {
  createDirtyWorktreeMessage,
  createMissingPullRequestMessage,
  getCompletionRequirements
} from "./lib/pull-request-publish.js";
import { createRetrospectiveArtifact } from "./lib/retrospective.js";
import { exportTranscriptIfAvailable } from "./lib/transcript-capture.js";

type CommandName = "end" | "note" | "start";

const SESSION_FILE = path.resolve(".agent-session.json");

interface AgentSession {
  projectKey?: string;
  runId: string;
  startedAt: string;
  task?: string;
  workflowName: string;
  workItemId?: string;
}

async function writeSessionFile(session: AgentSession): Promise<void> {
  await writeFile(SESSION_FILE, `${JSON.stringify(session, null, 2)}\n`);
}

async function clearSessionFile(): Promise<void> {
  await rm(SESSION_FILE, { force: true });
}

async function main(): Promise<void> {
  const [commandName, ...rawArgs] = process.argv.slice(2);

  if (!isCommandName(commandName)) {
    throw new Error("Expected one of: start, note, end");
  }

  const args = parseArgs(commandName, rawArgs);
  const workflow = args.workflow;

  if (commandName === "start") {
    await startWorkflow(workflow, args.task, resolveContextArgs(args));
    return;
  }

  if (commandName === "note") {
    if (args.message === undefined) {
      throw new Error("Missing note message.");
    }

    await writeWorkflowNote(workflow, args.message);
    return;
  }

  await endWorkflow(workflow, args.status, args.message);
}

async function startWorkflow(
  workflow: string,
  task: string | undefined,
  context: AuditRunContextFields
): Promise<void> {
  await warnIfSessionAlreadyActive(workflow);
  if (context.workItemId !== undefined) {
    warnIfOpenPrExistsForWorkItem(context.workItemId);
  }

  const runId = createRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = createWorkflowSummary(runId, workflow, task, context);

  await writeSummary(paths, summary);
  await appendAuditEvent(
    paths,
    createEvent(
      runId,
      workflow,
      "workflow-start",
      task === undefined ? { ...getEventContextFields(summary), status: "running" } : { ...getEventContextFields(summary), status: "running", task }
    )
  );
  await setActiveRun(workflow, runId, task);
  await writeSessionFile({
    runId,
    startedAt: summary.startedAt,
    workflowName: workflow,
    ...(context.workItemId === undefined ? {} : { workItemId: context.workItemId }),
    ...(context.project === undefined ? {} : { projectKey: context.project }),
    ...(task === undefined ? {} : { task })
  });

  process.stdout.write(`${runId}\n`);
}

async function writeWorkflowNote(workflow: string, message: string): Promise<void> {
  const runId = await getExistingRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = (await readSummary(paths)) ?? createWorkflowSummary(runId, workflow);

  await appendAuditEvent(
    paths,
    createEvent(runId, workflow, "workflow-note", {
      ...getEventContextFields(summary),
      metadata: {
        message
      },
      status: "running"
    })
  );
}

async function endWorkflow(workflow: string, status: "failed" | "success", message?: string): Promise<void> {
  ensureWorkflowCanClose(workflow, status);
  const runId = await getExistingRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = (await readSummary(paths)) ?? createWorkflowSummary(runId, workflow);
  const completedAt = new Date().toISOString();

  summary.completedAt = completedAt;
  summary.durationMs = Date.parse(completedAt) - Date.parse(summary.startedAt);
  summary.status = status;

  await writeSummary(paths, summary);
  await appendAuditEvent(
    paths,
    createEvent(
      runId,
      workflow,
      "workflow-end",
      message === undefined ? { ...getEventContextFields(summary), status } : { ...getEventContextFields(summary), metadata: { message }, status }
    )
  );
  await exportTranscriptIfAvailable({
    runId,
    ...(summary.workItemId === undefined ? {} : { workItemId: summary.workItemId })
  });
  await clearActiveRun(workflow);
  await clearSessionFile();
  await captureRetrospective(runId);
}

async function captureRetrospective(runId: string): Promise<void> {
  try {
    const retro = await createRetrospectiveArtifact(runId);
    process.stdout.write(`Retrospective written: ${retro.paths.outputPath}\n`);
  } catch {
    // Non-fatal: retrospective capture failing should not block workflow:end
  }
}

function ensureWorkflowCanClose(workflow: string, status: "failed" | "success"): void {
  const worktreeDirty = isWorktreeDirty();
  const completionRequirements = getCompletionRequirements({
    commitsAhead: getCommitsAhead("main"),
    status,
    workflow,
    worktreeDirty
  });

  if (completionRequirements.requiresCleanWorktree && worktreeDirty) {
    throw new Error(createDirtyWorktreeMessage());
  }

  if (completionRequirements.requiresPullRequest && !hasOpenPullRequestForCurrentBranch()) {
    throw new Error(createMissingPullRequestMessage());
  }
}

async function warnIfSessionAlreadyActive(workflow: string): Promise<void> {
  const { readAgentSession } = await import("./lib/session.js");
  const session = await readAgentSession();

  if (session === undefined) return;

  const ageMin = Math.round((Date.now() - Date.parse(session.startedAt)) / 60000);
  const idLabel = session.workItemId !== undefined ? ` (${session.workItemId})` : "";
  process.stderr.write(
    `[workflow:start] WARNING: An active session already exists:\n` +
    `  workflow: ${session.workflowName}${idLabel}\n` +
    `  run ID:   ${session.runId}\n` +
    `  started:  ${String(ageMin)}m ago\n` +
    `  To resume it: npm run workflow:note ${workflow} "resuming"\n` +
    `  To close it:  npm run workflow:end ${session.workflowName} success|failed\n`
  );
}

function warnIfOpenPrExistsForWorkItem(workItemId: string): void {
  try {
    const stdout = execFileSync(
      "gh",
      ["pr", "list", "--state", "open", "--search", workItemId, "--json", "number,title,headRefName"],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const prs = JSON.parse(stdout) as { number: number; title: string; headRefName: string }[];

    if (prs.length > 0) {
      const list = prs.map((pr) => `  #${String(pr.number)} — ${pr.headRefName}: ${pr.title}`).join("\n");
      process.stderr.write(
        `[workflow:start] WARNING: Open PR(s) already exist for ${workItemId}:\n${list}\n` +
        `  Review before starting duplicate work.\n`
      );
    }
  } catch {
    // gh not available or not in a GitHub repo — skip silently
  }
}

function isWorktreeDirty(): boolean {
  return runGit(["status", "--porcelain"]).trim().length > 0;
}

function getCommitsAhead(baseBranch: string): number {
  const compareRef = resolveCompareRef(baseBranch);
  return Number(runGit(["rev-list", "--count", `${compareRef}..HEAD`]).trim());
}

function resolveCompareRef(baseBranch: string): string {
  try {
    runGit(["rev-parse", "--verify", `origin/${baseBranch}`], "ignore");
    return `origin/${baseBranch}`;
  } catch {
    return baseBranch;
  }
}

function hasOpenPullRequestForCurrentBranch(): boolean {
  const branch = runGit(["branch", "--show-current"]).trim();

  if (branch.length === 0 || branch === "HEAD" || branch === "main") {
    return false;
  }

  const stdout = execFileSync("gh", ["pr", "list", "--state", "open", "--head", branch, "--json", "number"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  const pullRequests = JSON.parse(stdout) as { number: number }[];

  return pullRequests.length > 0;
}

function runGit(args: string[], stdio: "ignore" | "pipe" = "pipe"): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio
  });
}

async function getExistingRunId(workflow: string): Promise<string> {
  const runId = await getActiveRunId(workflow);

  if (runId === null) {
    throw new Error(`No active workflow found for "${workflow}". Run workflow:start first.`);
  }

  return runId;
}

function isCommandName(value: string | undefined): value is CommandName {
  return value === "end" || value === "note" || value === "start";
}

interface ParsedArgs {
  agentName?: string;
  message?: string;
  planRunId?: string;
  planStepId?: string;
  project?: string;
  sessionId?: string;
  status: "failed" | "success";
  task?: string;
  workflow: string;
  workItemId?: string;
}

function parseArgs(commandName: CommandName, rawArgs: string[]): ParsedArgs {
  if (looksLikeFlagForm(rawArgs)) {
    return parseFlagArgs(rawArgs);
  }

  return parsePositionalArgs(commandName, rawArgs);
}

function parseFlagArgs(rawArgs: string[]): ParsedArgs {
  const parsed: Partial<ParsedArgs> = {};

  for (const [key, value] of toFlagEntries(rawArgs)) {
    assignFlagArg(parsed, key, value);
  }

  if (parsed.workflow === undefined) {
    throw new Error("Missing required argument --workflow");
  }

  return finalizeParsedFlagArgs(parsed, parsed.workflow);
}

function toFlagEntries(rawArgs: string[]): [string, string][] {
  const entries: [string, string][] = [];

  for (let index = 0; index < rawArgs.length; index += 2) {
    const key = rawArgs[index];
    const value = rawArgs[index + 1];

    if (key === undefined || value === undefined || !key.startsWith("--")) {
      throw new Error("Arguments must be passed as --name value pairs.");
    }

    entries.push([key, value]);
  }

  return entries;
}

function parsePositionalArgs(commandName: CommandName, rawArgs: string[]): ParsedArgs {
  const [workflow, ...rest] = rawArgs;

  if (workflow === undefined || workflow.length === 0) {
    throw new Error("Missing workflow name.");
  }

  if (commandName === "start") {
    return {
      status: "success",
      workflow,
      ...(rest.length === 0 ? {} : { task: rest.join(" ") })
    };
  }

  if (commandName === "note") {
    if (rest.length === 0) {
      throw new Error("Missing note message.");
    }

    return {
      message: rest.join(" "),
      status: "success",
      workflow
    };
  }

  const [status, ...messageParts] = rest;

  if (status !== "failed" && status !== "success") {
    throw new Error("Workflow end status must be success or failed.");
  }

  return {
    status,
    workflow,
    ...(messageParts.length === 0 ? {} : { message: messageParts.join(" ") })
  };
}

function looksLikeFlagForm(rawArgs: string[]): boolean {
  return rawArgs.some((arg) => arg.startsWith("--"));
}

function assignFlagArg(parsed: Partial<ParsedArgs>, key: string, value: string): void {
  switch (key) {
    case "--status":
      parsed.status = value === "failed" ? "failed" : "success";
      break;
    case "--workflow":
      parsed.workflow = value;
      break;
    case "--message":
      parsed.message = value;
      break;
    case "--agent-name":
      parsed.agentName = value;
      break;
    case "--project":
      parsed.project = value;
      break;
    case "--plan-run-id":
      parsed.planRunId = value;
      break;
    case "--plan-step-id":
      parsed.planStepId = value;
      break;
    case "--session-id":
      parsed.sessionId = value;
      break;
    case "--task":
      parsed.task = value;
      break;
    case "--work-item-id":
      parsed.workItemId = value;
      break;
    default:
      throw new Error(`Unknown argument: ${key}`);
  }
}

function resolveContextArgs(args: ParsedArgs): AuditRunContextFields {
  return {
    ...(args.agentName === undefined ? {} : { agentName: args.agentName }),
    ...(args.planRunId === undefined ? {} : { planRunId: args.planRunId }),
    ...(args.planStepId === undefined ? {} : { planStepId: args.planStepId }),
    ...(args.project === undefined ? {} : { project: args.project }),
    ...(args.sessionId === undefined ? {} : { sessionId: args.sessionId }),
    ...(args.workItemId === undefined ? {} : { workItemId: args.workItemId })
  };
}

function finalizeParsedFlagArgs(parsed: Partial<ParsedArgs>, workflow: string): ParsedArgs {
  return {
    ...(parsed.agentName === undefined ? {} : { agentName: parsed.agentName }),
    ...(parsed.message === undefined ? {} : { message: parsed.message }),
    ...(parsed.planRunId === undefined ? {} : { planRunId: parsed.planRunId }),
    ...(parsed.planStepId === undefined ? {} : { planStepId: parsed.planStepId }),
    ...(parsed.project === undefined ? {} : { project: parsed.project }),
    ...(parsed.sessionId === undefined ? {} : { sessionId: parsed.sessionId }),
    status: parsed.status ?? "success",
    ...(parsed.task === undefined ? {} : { task: parsed.task }),
    workflow,
    ...(parsed.workItemId === undefined ? {} : { workItemId: parsed.workItemId })
  };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
