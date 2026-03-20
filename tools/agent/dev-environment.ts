import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import {
  appendAuditEvent,
  clearActiveRun,
  createEvent,
  createRunId,
  createWorkflowSummary,
  ensureAuditPaths,
  setActiveRun,
  slugify,
  writeSummary,
  type AuditPaths,
  type AuditSummary
} from "./lib/audit.js";
import { endExecution, startExecution, type AuditRunContext, type StartedExecution } from "./lib/execution.js";
import { resolveNpmCommand } from "./lib/process.js";
import {
  createShutdownSignal,
  ensureCheckoutPrerequisites,
  ensureServicePortsAvailable,
  pipePrefixedOutput,
  resolveMainCheckoutRoot,
  sanitizeEnv,
  stopServices,
  waitForServiceHealth
} from "./lib/dev-environment-runtime.js";
import {
  createDevEnvironmentPlan,
  parseDevEnvironmentArgs,
  renderDevEnvironmentCatalog,
  renderDevEnvironmentPlan,
  type DevEnvironmentPlan,
  type DevServiceLaunchPlan
} from "./lib/dev-environment.js";

type CommandName = "list" | "start";

interface LaunchedService {
  child: ReturnType<typeof spawn>;
  completion: Promise<ServiceExit>;
  execution: StartedExecution;
  logFile: string;
  service: DevServiceLaunchPlan;
}

interface ServiceExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

async function main(): Promise<void> {
  const [commandName, ...rawArgs] = process.argv.slice(2);

  if (!isCommandName(commandName)) {
    throw new Error("Expected one of: list, start");
  }

  const parsed = parseDevEnvironmentArgs(rawArgs, {
    requireEnvironmentSelection: commandName === "start"
  });
  const mainCheckoutRoot = resolveMainCheckoutRoot(process.cwd());
  const plan = createDevEnvironmentPlan(parsed, {
    main: mainCheckoutRoot
  });

  if (commandName === "list") {
    process.stdout.write(`${renderDevEnvironmentCatalog()}\n`);
    return;
  }

  if (parsed.dryRun) {
    process.stdout.write(`${renderDevEnvironmentPlan(plan)}\n`);
    return;
  }

  ensureCheckoutPrerequisites(plan.checkoutRoot);
  await runDevelopmentEnvironment(plan);
}

async function runDevelopmentEnvironment(plan: DevEnvironmentPlan): Promise<void> {
  const workflow = `dev-environment-${slugify(plan.environments.map((environment) => environment.id).join("-")) || "workspace"}-${process.pid.toString()}`;
  const runId = createRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = createWorkflowSummary(runId, workflow, "Run local development environment", {
    project: "workspace"
  });
  const context: AuditRunContext = {
    paths,
    runId,
    summary,
    workflow
  };
  const launched: LaunchedService[] = [];

  await initializeAuditRun(context, plan);

  try {
    await ensureServicePortsAvailable(plan.services);
    await launchServices(context, plan, launched);
    const exitCode = await waitForShutdown(context, plan, launched);

    process.exitCode = exitCode;
  } catch (error) {
    stopServices(launched.map((service) => service.child));
    await Promise.allSettled(launched.map((service) => service.completion));
    await finalizeAuditRun({
      metadata: {
        checkout: plan.checkout,
        environments: plan.environments.map((environment) => environment.id),
        error: error instanceof Error ? error.message : String(error)
      },
      paths: context.paths,
      runId: context.runId,
      status: "failed",
      summary: context.summary,
      workflow: context.workflow
    });
    throw error;
  }
}

async function initializeAuditRun(context: AuditRunContext, plan: DevEnvironmentPlan): Promise<void> {
  const startEvent = createEvent(context.runId, context.workflow, "workflow-start", {
    metadata: {
      checkout: plan.checkout,
      checkoutRoot: plan.checkoutRoot,
      environments: plan.environments.map((environment) => environment.id),
      services: plan.services.map((service) => service.id)
    },
    status: "running"
  });

  if (context.summary.task !== undefined) {
    startEvent.task = context.summary.task;
  }

  await appendAuditEvent(
    context.paths,
    startEvent
  );
  await writeSummary(context.paths, context.summary);
  await setActiveRun(context.workflow, context.runId, context.summary.task);
}

async function launchServices(
  context: AuditRunContext,
  plan: DevEnvironmentPlan,
  launched: LaunchedService[]
): Promise<void> {
  const npmCommand = resolveNpmCommand();

  process.stdout.write(`${renderDevEnvironmentPlan(plan)}\n`);
  process.stdout.write(`Audit Run: ${context.runId}\n`);
  process.stdout.write("Press Ctrl+C to stop all services.\n");

  for (const service of plan.services) {
    const logFile = path.join(context.paths.logsDir, `${service.id}.log`);
    await mkdir(path.dirname(logFile), { recursive: true });
    const output = createWriteStream(logFile, { flags: "a" });
    const command = [npmCommand.command, ...npmCommand.prefixArgs, ...service.commandArgs];
    const execution = await startExecution(context, {
      command,
      kind: "command",
      metadata: {
        checkoutRoot: plan.checkoutRoot,
        primaryUrl: service.primaryUrl,
        workspace: service.workspace
      },
      name: service.id,
      step: service.id
    });
    const child = spawn(npmCommand.command, [...npmCommand.prefixArgs, ...service.commandArgs], {
      cwd: plan.checkoutRoot,
      detached: process.platform !== "win32",
      env: sanitizeEnv(process.env),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const completion = trackServiceCompletion(context, {
      child,
      execution,
      logFile,
      output,
      service
    });
    await waitForLaunchedService(service, completion);

    launched.push({
      child,
      completion,
      execution,
      logFile,
      service
    });
  }
}

async function waitForLaunchedService(service: DevServiceLaunchPlan, completion: Promise<ServiceExit>): Promise<void> {
  if (service.healthUrl === undefined) {
    return;
  }

  await Promise.race([
    waitForServiceHealth({
      healthUrl: service.healthUrl,
      serviceLabel: service.label
    }),
    completion.then((exit) => {
      throw new Error(
        `${service.id} exited before it became healthy (code: ${(exit.code ?? "null").toString()}, signal: ${exit.signal ?? "none"}).`
      );
    })
  ]);
}

async function trackServiceCompletion(
  context: AuditRunContext,
  state: {
    child: ReturnType<typeof spawn>;
    execution: StartedExecution;
    logFile: string;
    output: NodeJS.WritableStream;
    service: DevServiceLaunchPlan;
  }
): Promise<ServiceExit> {
  const prefixedStdout = state.child.stdout;
  const prefixedStderr = state.child.stderr;

  if (prefixedStdout !== null) {
    pipePrefixedOutput(prefixedStdout, process.stdout, state.output, state.service.id);
  }

  if (prefixedStderr !== null) {
    pipePrefixedOutput(prefixedStderr, process.stderr, state.output, state.service.id);
  }

  return await new Promise<ServiceExit>((resolve, reject) => {
    state.child.once("error", async (error) => {
      state.output.end();
      await endExecution(context, state.execution, {
        error,
        logFile: state.logFile,
        status: "failed"
      });
      reject(error);
    });

    state.child.once("exit", async (code, signal) => {
      state.output.end();
      await endExecution(context, state.execution, {
        exitCode: code ?? 1,
        logFile: state.logFile,
        metadata: {
          signal: signal ?? "none"
        },
        status: code === 0 ? "success" : "failed"
      });
      resolve({
        code,
        signal
      });
    });
  });
}

async function waitForShutdown(context: AuditRunContext, plan: DevEnvironmentPlan, launched: LaunchedService[]): Promise<number> {
  const shutdownSignal = createShutdownSignal();
  const unexpectedExit = Promise.race(
    launched.map(async (service) => ({
      exit: await service.completion,
      service
    }))
  );
  const outcome = await Promise.race([
    unexpectedExit.then((value) => ({
      type: "exit" as const,
      value
    })),
    shutdownSignal.promise.then((value) => ({
      type: "signal" as const,
      value
    }))
  ]);

  if (outcome.type === "signal") {
    process.stdout.write(`Stopping services after ${outcome.value}.\n`);
    stopServices(launched.map((service) => service.child));
    await Promise.allSettled(launched.map((service) => service.completion));
    await finalizeAuditRun({
      metadata: {
        checkout: plan.checkout,
        environments: plan.environments.map((environment) => environment.id),
        reason: outcome.value
      },
      paths: context.paths,
      runId: context.runId,
      status: "success",
      summary: context.summary,
      workflow: context.workflow
    });
    return 0;
  }

  const exitCode = outcome.value.exit.code ?? 1;
  process.stderr.write(
    `Service ${outcome.value.service.service.id} exited unexpectedly with code ${exitCode.toString()}. Stopping the remaining services.\n`
  );
  stopServices(launched.map((service) => service.child));
  await Promise.allSettled(launched.map((service) => service.completion));
  await finalizeAuditRun({
    metadata: {
      checkout: plan.checkout,
      environments: plan.environments.map((environment) => environment.id),
      failedService: outcome.value.service.service.id,
      failedSignal: outcome.value.exit.signal ?? "none"
    },
    paths: context.paths,
    runId: context.runId,
    status: "failed",
    summary: context.summary,
    workflow: context.workflow
  });
  return exitCode === 0 ? 1 : exitCode;
}

async function finalizeAuditRun(input: {
  metadata: Record<string, string | string[]>;
  paths: AuditPaths;
  runId: string;
  status: "failed" | "success";
  summary: AuditSummary;
  workflow: string;
}): Promise<void> {
  const completedAt = new Date().toISOString();
  input.summary.completedAt = completedAt;
  input.summary.durationMs = Date.parse(completedAt) - Date.parse(input.summary.startedAt);
  input.summary.status = input.status;

  try {
    await appendAuditEvent(
      input.paths,
      createEvent(input.runId, input.workflow, "workflow-end", {
        metadata: input.metadata,
        status: input.status
      })
    );

    await writeSummary(input.paths, input.summary);
  } finally {
    await clearActiveRun(input.workflow);
  }
}

function isCommandName(value: string | undefined): value is CommandName {
  return value === "list" || value === "start";
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
