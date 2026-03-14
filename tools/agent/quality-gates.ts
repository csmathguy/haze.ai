import { execFileSync } from "node:child_process";

import {
  appendAuditEvent,
  type AuditSummary,
  clearActiveRun,
  createEvent,
  createRunId,
  createWorkflowSummary,
  ensureAuditPaths,
  getActiveRunId,
  readSummary,
  setActiveRun,
  writeSummary
} from "./lib/audit.js";
import { endExecution, startExecution } from "./lib/execution.js";
import { resolveNpmCommand, runLoggedCommand } from "./lib/process.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const workflow = options.workflow ?? "quality-gates";
  const run = await initializeRun(workflow);
  const failed = await executeSteps(workflow, run, options.withCoverage);

  await finalizeRun(workflow, run, failed);

  if (failed) {
    process.exitCode = 1;
  }
}

async function executeSteps(workflow: string, run: InitializedRun, withCoverage: boolean): Promise<boolean> {
  warnIfSharedPackagesStale();
  const npmCommand = resolveNpmCommand();
  const steps = [
    { args: ["run", "prisma:check"], command: npmCommand, step: "prisma-check" },
    { args: ["run", "typecheck"], command: npmCommand, step: "typecheck" },
    { args: ["run", "lint"], command: npmCommand, step: "lint" },
    { args: ["run", "stylelint"], command: npmCommand, step: "stylelint" },
    { args: ["run", withCoverage ? "test:coverage" : "test"], command: npmCommand, step: withCoverage ? "test-coverage" : "test" }
  ];

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
        withCoverage
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
  if (run.createdRun) {
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
    await clearActiveRun(workflow);
  } else {
    await writeSummary(run.paths, run.summary);
    await appendAuditEvent(
      run.paths,
      createEvent(run.runId, workflow, "workflow-note", {
        metadata: {
          message: failed ? "quality-gates failed" : "quality-gates succeeded"
        },
        status: failed ? "failed" : "running"
      })
    );
  }
}

interface ParsedArgs {
  withCoverage: boolean;
  workflow?: string;
}

interface InitializedRun {
  createdRun: boolean;
  paths: Awaited<ReturnType<typeof ensureAuditPaths>>;
  runId: string;
  summary: AuditSummary;
}

async function initializeRun(workflow: string): Promise<InitializedRun> {
  const existingRunId = await getActiveRunId(workflow);
  const runId = existingRunId ?? createRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = (await readSummary(paths)) ?? createWorkflowSummary(runId, workflow, "Run repository guardrails");

  if (existingRunId === null) {
    await writeSummary(paths, summary);
    await appendAuditEvent(
      paths,
      createEvent(runId, workflow, "workflow-start", summary.task === undefined ? { status: "running" } : { status: "running", task: summary.task })
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

function parseArgs(rawArgs: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    withCoverage: false
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index];

    if (current === "--with-coverage") {
      parsed.withCoverage = true;
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

    if (current !== undefined && !current.startsWith("--") && parsed.workflow === undefined) {
      parsed.workflow = current;
      continue;
    }

    if (current === undefined) {
      throw new Error("Unknown empty argument");
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return parsed;
}

function warnIfSharedPackagesStale(): void {
  try {
    const diverged = execFileSync(
      "git",
      ["log", "HEAD..origin/main", "--oneline", "--", "packages/"],
      {
        cwd: process.cwd(),
        encoding: "utf8"
      }
    )
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (diverged.length > 0) {
      process.stderr.write(
        `[quality-gates] WARNING: origin/main has ${String(diverged.length)} commit(s) to packages/ not in HEAD.\n` +
          `[quality-gates] Merge main before pushing to avoid schema version mismatches.\n` +
          `[quality-gates]   Run: git merge origin/main\n` +
          diverged.map((c) => `[quality-gates]   ${c}\n`).join("")
      );
    }
  } catch {
    // Non-fatal: skip freshness check if git commands fail (e.g. no remote)
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
