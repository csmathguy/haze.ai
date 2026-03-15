import { readFile } from "node:fs/promises";
import * as path from "node:path";

import {
  createWorkflowSummary,
  ensureAuditPaths,
  getActiveExecution,
  getActiveRunId,
  readSummary,
  type AuditExecutionKind,
  type AuditMetadataValue,
  type AuditMetadata,
  type WorkflowStatus,
  writeSummary
} from "./lib/audit.js";
import { endExecution, startExecution, type StartedExecution } from "./lib/execution.js";

const SESSION_FILE = path.resolve(".agent-session.json");

async function readSessionWorkflow(): Promise<string | undefined> {
  try {
    const contents = await readFile(SESSION_FILE, "utf8");
    const session = JSON.parse(contents) as { workflowName?: unknown };
    return typeof session.workflowName === "string" ? session.workflowName : undefined;
  } catch {
    return undefined;
  }
}

async function injectWorkflowIfMissing(rawArgs: string[]): Promise<string[]> {
  if (rawArgs.includes("--workflow")) {
    return rawArgs;
  }

  const workflowName = await readSessionWorkflow();

  if (workflowName === undefined) {
    return rawArgs;
  }

  return ["--workflow", workflowName, ...rawArgs];
}

type CommandName = "end" | "start";

async function main(): Promise<void> {
  const [commandName, ...rawArgs] = process.argv.slice(2);

  if (!isCommandName(commandName)) {
    throw new Error("Expected one of: start, end");
  }

  const enrichedArgs = await injectWorkflowIfMissing(rawArgs);

  if (commandName === "start") {
    const args = parseStartArgs(enrichedArgs);
    const context = await resolveRunContext(args.workflow);
    const started = await startExecution(context, args);

    process.stdout.write(`${started.executionId}\n`);
    return;
  }

  const args = parseEndArgs(enrichedArgs);
  const context = await resolveRunContext(args.workflow);
  const activeExecution = await getActiveExecution(args.workflow, args.executionId);

  if (activeExecution === null) {
    throw new Error(`No active execution found for "${args.executionId}" in workflow "${args.workflow}".`);
  }

  const endMetadata = buildEndMetadata(args.message, args.metadata);

  await endExecution(context, activeExecution as StartedExecution, {
    ...(args.exitCode === undefined ? {} : { exitCode: args.exitCode }),
    ...(endMetadata === undefined ? {} : { metadata: endMetadata }),
    status: args.status
  });
}

interface StartArgs {
  command?: string[];
  kind: AuditExecutionKind;
  metadata?: AuditMetadata;
  name: string;
  parentExecutionId?: string;
  step?: string;
  workflow: string;
}

interface EndArgs {
  executionId: string;
  exitCode?: number;
  message?: string;
  metadata?: AuditMetadata;
  status: WorkflowStatus;
  workflow: string;
}

async function resolveRunContext(workflow: string) {
  const runId = await getExistingRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = (await readSummary(paths)) ?? createWorkflowSummary(runId, workflow);

  await writeSummary(paths, summary);

  return {
    paths,
    runId,
    summary,
    workflow
  };
}

async function getExistingRunId(workflow: string): Promise<string> {
  const runId = await getActiveRunId(workflow);

  if (runId === null) {
    throw new Error(`No active workflow found for "${workflow}". Run workflow:start first.`);
  }

  return runId;
}

function isCommandName(value: string | undefined): value is CommandName {
  return value === "end" || value === "start";
}

function parseStartArgs(rawArgs: string[]): StartArgs {
  const parsed = parseFlagPairs(rawArgs);
  const workflow = readRequiredString(parsed, "--workflow");
  const kind = readExecutionKind(parsed, "--kind");
  const name = readRequiredString(parsed, "--name");

  return {
    kind,
    name,
    workflow,
    ...(parsed["--parent-execution-id"] === undefined
      ? {}
      : { parentExecutionId: readRequiredString(parsed, "--parent-execution-id") }),
    ...(parsed["--step"] === undefined ? {} : { step: readRequiredString(parsed, "--step") }),
    ...(parsed["--metadata"] === undefined ? {} : { metadata: parseMetadataEntries(parsed["--metadata"]) })
  };
}

function parseEndArgs(rawArgs: string[]): EndArgs {
  const parsed = parseFlagPairs(rawArgs);
  const workflow = readRequiredString(parsed, "--workflow");
  const executionId = readRequiredString(parsed, "--execution-id");

  return {
    executionId,
    status: parsed["--status"] === undefined ? "success" : readWorkflowStatus(parsed, "--status"),
    workflow,
    ...(parsed["--exit-code"] === undefined ? {} : { exitCode: readNumber(parsed, "--exit-code") }),
    ...(parsed["--message"] === undefined ? {} : { message: readRequiredString(parsed, "--message") }),
    ...(parsed["--metadata"] === undefined ? {} : { metadata: parseMetadataEntries(parsed["--metadata"]) })
  };
}

function parseFlagPairs(rawArgs: string[]): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const key = rawArgs[index];

    if (key?.startsWith("--") !== true) {
      throw new Error("Arguments must be passed as --name value pairs.");
    }

    const value = rawArgs[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value after ${key}`);
    }

    parsed[key] = [...(parsed[key] ?? []), value];
    index += 1;
  }

  return parsed;
}

function readExecutionKind(parsed: Record<string, string[]>, key: string): AuditExecutionKind {
  const value = readRequiredString(parsed, key);

  if (
    value === "command" ||
    value === "hook" ||
    value === "operation" ||
    value === "skill" ||
    value === "tool" ||
    value === "validation"
  ) {
    return value;
  }

  throw new Error(`Unknown execution kind: ${value}`);
}

function readWorkflowStatus(parsed: Record<string, string[]>, key: string): WorkflowStatus {
  const value = readRequiredString(parsed, key);

  if (value === "failed" || value === "running" || value === "skipped" || value === "success") {
    return value;
  }

  throw new Error(`Unknown workflow status: ${value}`);
}

function readRequiredString(parsed: Record<string, string[]>, key: string): string {
  const value = parsed[key]?.at(-1);

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required argument ${key}`);
  }

  return value;
}

function readNumber(parsed: Record<string, string[]>, key: string): number {
  const value = Number(readRequiredString(parsed, key));

  if (Number.isNaN(value)) {
    throw new Error(`Expected a number for ${key}`);
  }

  return value;
}

function parseMetadataEntries(entries: string[]): AuditMetadata {
  return Object.fromEntries(
    entries.map((entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex <= 0) {
        throw new Error(`Metadata entries must use key=value form. Received "${entry}".`);
      }

      const key = entry.slice(0, separatorIndex);
      const rawValue = entry.slice(separatorIndex + 1);

      return [key, parseMetadataValue(rawValue)];
    })
  );
}

function parseMetadataValue(value: string): AuditMetadataValue {
  let parsed: AuditMetadataValue = value;

  if (value === "true") {
    parsed = true;
  }

  if (value === "false") {
    parsed = false;
  }

  if (value === "null") {
    parsed = null;
  }

  const numericValue = Number(value);

  if (!Number.isNaN(numericValue) && value.trim().length > 0) {
    parsed = numericValue;
  }

  return parsed;
}

function buildEndMetadata(message: string | undefined, metadata: AuditMetadata | undefined): AuditMetadata | undefined {
  if (message === undefined && metadata === undefined) {
    return undefined;
  }

  return {
    ...(metadata ?? {}),
    ...(message === undefined ? {} : { message })
  };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
