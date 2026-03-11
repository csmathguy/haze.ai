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
  type AuditSummary,
  writeSummary
} from "./lib/audit.js";
import { buildChangedFilePlan } from "./lib/changed-files.js";
import { resolveNpmCommand, runLoggedCommand, type LoggedCommand, type ResolvedCommand } from "./lib/process.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const files = options.files.length > 0 ? options.files : getChangedFiles(options.staged);

  if (files.length === 0) {
    process.stdout.write("No changed files detected.\n");
    return;
  }

  const plan = buildChangedFilePlan(files);
  const steps = buildCommands(plan);

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

function buildCommands(plan: ReturnType<typeof buildChangedFilePlan>): LoggedCommand[] {
  const npmCommand = resolveNpmCommand();
  const commands: LoggedCommand[] = [];

  if (plan.prismaCheck) {
    commands.push({
      args: ["run", "prisma:check"],
      command: npmCommand,
      step: "prisma-check"
    });
  }

  if (plan.lintTargets.length > 0) {
    commands.push({
      args: ["exec", "eslint", "--", "--max-warnings=0", ...plan.lintTargets],
      command: npmCommand,
      step: "lint-changed"
    });
  }

  if (plan.stylelintTargets.length > 0) {
    commands.push({
      args: ["exec", "stylelint", "--", "--allow-empty-input", ...plan.stylelintTargets],
      command: npmCommand,
      step: "stylelint-changed"
    });
  }

  for (const scope of plan.typecheckScopes) {
    commands.push({
      args: ["run", `typecheck:${scope}`],
      command: npmCommand,
      step: `typecheck-${scope}`
    });
  }

  commands.push(...buildTestCommands(npmCommand, plan));

  return commands;
}

function buildTestCommands(npmCommand: ResolvedCommand, plan: ReturnType<typeof buildChangedFilePlan>): LoggedCommand[] {
  switch (plan.testCommand.kind) {
    case "arch":
      return [
        {
          args: ["run", "test:arch"],
          command: npmCommand,
          step: "test-arch"
        }
      ];
    case "full":
      return [
        {
          args: ["run", "test"],
          command: npmCommand,
          step: "test"
        }
      ];
    case "related":
      return [
        {
          args: ["exec", "vitest", "--", "related", "--run", ...plan.testCommand.targets],
          command: npmCommand,
          step: "test-related"
        }
      ];
    case "none":
      return [];
  }
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
  }

  return {
    createdRun: existingRunId === null,
    paths,
    runId,
    summary
  };
}

async function executeSteps(workflow: string, run: InitializedRun, steps: LoggedCommand[]): Promise<boolean> {
  let failed = false;

  for (const step of steps) {
    const result = await runLoggedCommand(workflow, run.runId, run.paths, step);
    run.summary.steps.push(result);

    if (result.exitCode !== 0) {
      failed = true;
      break;
    }
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
