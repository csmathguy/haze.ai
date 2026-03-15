import { execFileSync } from "node:child_process";

import {
  appendAuditEvent,
  clearActiveRun,
  createEvent,
  createRunId,
  createWorkflowSummary,
  ensureAuditPaths,
  getActiveRunId,
  readSummary,
  setActiveRun,
  type AuditSummary,
  writeSummary
} from "./lib/audit.js";
import { buildChangedQualityCommands } from "./lib/changed-quality-commands.js";
import { buildChangedFilePlan } from "./lib/changed-files.js";
import { endExecution, startExecution } from "./lib/execution.js";
import { resolveNpmCommand, runLoggedCommand, type LoggedCommand } from "./lib/process.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const files = options.files.length > 0 ? options.files : getChangedFiles(options.staged);

  if (files.length === 0) {
    process.stdout.write("No changed files detected.\n");
    return;
  }

  const plan = buildChangedFilePlan(files);
  const steps = buildCommands(files, plan, options.pool);

  if (steps.length === 0) {
    process.stdout.write("No code validation required for the detected files.\n");
    return;
  }

  const workflow = options.workflow ?? "changed-quality";
  const run = await initializeRun(workflow, files);
  const failed = await executeSteps(workflow, run, steps);

  await finalizeRun(workflow, run, failed);

  if (failed) {
    process.exitCode = 1;
  }
}

interface ParsedArgs {
  files: string[];
  pool?: string;
  staged: boolean;
  workflow?: string;
}

interface InitializedRun {
  createdRun: boolean;
  paths: Awaited<ReturnType<typeof ensureAuditPaths>>;
  runId: string;
  summary: AuditSummary;
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

    if (current === "--workflow") {
      const workflow = rawArgs[index + 1];

      if (workflow === undefined) {
        throw new Error("Missing value after --workflow");
      }

      parsed.workflow = workflow;
      index += 1;
      continue;
    }

    if (current === "--pool") {
      const pool = rawArgs[index + 1];

      if (pool === undefined) {
        throw new Error("Missing value after --pool");
      }

      parsed.pool = pool;
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

function getChangedFiles(staged: boolean): string[] {
  const gitArgs = staged ? ["diff", "--name-only", "--cached", "--diff-filter=ACMR"] : getHeadDiffArgs();
  const stdout = execFileSync("git", gitArgs, {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  return stdout
    .split(/\r?\n/gu)
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

function getHeadDiffArgs(): string[] {
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

function buildCommands(files: string[], plan: ReturnType<typeof buildChangedFilePlan>, pool?: string): LoggedCommand[] {
  return buildChangedQualityCommands(files, resolveNpmCommand(), pool);
}

async function initializeRun(workflow: string, files: string[]): Promise<InitializedRun> {
  const existingRunId = await getActiveRunId(workflow);
  const runId = existingRunId ?? createRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = (await readSummary(paths)) ?? createWorkflowSummary(runId, workflow, `Validate changed files: ${files.join(", ")}`);

  if (existingRunId === null) {
    await writeSummary(paths, summary);
    await appendAuditEvent(
      paths,
      createEvent(runId, workflow, "workflow-start", {
        metadata: {
          mode: "changed-files"
        },
        status: "running",
        ...(summary.task === undefined ? {} : { task: summary.task })
      })
    );
    await setActiveRun(workflow, runId, summary.task);
  }

  return {
    createdRun: existingRunId === null,
    paths,
    runId,
    summary
  };
}

async function executeSteps(workflow: string, run: InitializedRun, steps: LoggedCommand[]): Promise<boolean> {
  const scope = await startExecution(
    {
      paths: run.paths,
      runId: run.runId,
      summary: run.summary,
      workflow
    },
    {
      kind: workflow.startsWith("pre-") ? "hook" : "validation",
      metadata: {
        mode: "changed-files"
      },
      name: workflow
    }
  );
  let failed = false;

  try {
    for (const step of steps) {
      const result = await runLoggedCommand(
        {
          paths: run.paths,
          runId: run.runId,
          summary: run.summary,
          workflow
        },
        step
      );

      if (result.exitCode !== 0) {
        failed = true;
        break;
      }
    }

    await endExecution(
      {
        paths: run.paths,
        runId: run.runId,
        summary: run.summary,
        workflow
      },
      scope,
      {
        status: failed ? "failed" : "success"
      }
    );
  } catch (error) {
    await endExecution(
      {
        paths: run.paths,
        runId: run.runId,
        summary: run.summary,
        workflow
      },
      scope,
      {
        error,
        status: "failed"
      }
    );
    throw error;
  }

  return failed;
}

async function finalizeRun(workflow: string, run: InitializedRun, failed: boolean): Promise<void> {
  const completedAt = new Date().toISOString();

  run.summary.completedAt = completedAt;
  run.summary.durationMs = Date.parse(completedAt) - Date.parse(run.summary.startedAt);
  run.summary.status = failed ? "failed" : "success";

  await writeSummary(run.paths, run.summary);
  await appendAuditEvent(
    run.paths,
    createEvent(run.runId, workflow, "workflow-end", {
      status: run.summary.status
    })
  );

  if (run.createdRun) {
    await clearActiveRun(workflow);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
