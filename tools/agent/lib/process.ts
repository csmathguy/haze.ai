import { createWriteStream } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import * as path from "node:path";

import type { AuditStepSummary } from "./audit.js";
import { endExecution, startExecution, type AuditRunContext, type StartedExecution } from "./execution.js";

export interface LoggedCommand {
  args: string[];
  command: ResolvedCommand;
  step: string;
}

export interface ResolvedCommand {
  command: string;
  prefixArgs: string[];
}

export type LoggedCommandContext = AuditRunContext;

export async function runLoggedCommand(
  context: LoggedCommandContext,
  loggedCommand: LoggedCommand
): Promise<AuditStepSummary> {
  await mkdir(context.paths.logsDir, { recursive: true });

  const logFile = path.join(context.paths.logsDir, `${loggedCommand.step}.log`);
  const output = createWriteStream(logFile, { flags: "a" });
  const startedExecution = await startCommandExecution(context, loggedCommand, logFile);
  const execution = await executeLoggedCommand(context, {
    logFile,
    loggedCommand,
    output,
    startedExecution
  });

  return toStepSummary(execution, loggedCommand, logFile);
}

export function resolveNpmCommand(): ResolvedCommand {
  const pinnedRuntime = resolvePinnedNpmRuntime(process.cwd());

  if (pinnedRuntime !== null) {
    return pinnedRuntime;
  }

  const npmExecPath = process.env.npm_execpath;

  if (typeof npmExecPath === "string" && npmExecPath.length > 0) {
    return {
      command: process.execPath,
      prefixArgs: [npmExecPath]
    };
  }

  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    prefixArgs: []
  };
}

function spawnWithTee(command: string, args: string[], output: NodeJS.WritableStream): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: sanitizeEnv(process.env),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.once("error", reject);

    child.stdout.on("data", (chunk: Buffer | string) => {
      process.stdout.write(chunk);
      output.write(chunk);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      process.stderr.write(chunk);
      output.write(chunk);
    });

    child.once("close", (code) => {
      output.end();
      resolve(code ?? 1);
    });
  });
}

function sanitizeEnv(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]]))
  );
}

async function startCommandExecution(
  context: LoggedCommandContext,
  loggedCommand: LoggedCommand,
  logFile: string
): Promise<StartedExecution> {
  return startExecution(context, {
    command: getCommandLine(loggedCommand),
    kind: "command",
    metadata: {
      logFile
    },
    name: loggedCommand.step,
    step: loggedCommand.step
  });
}

async function executeLoggedCommand(
  context: LoggedCommandContext,
  state: {
    logFile: string;
    loggedCommand: LoggedCommand;
    output: NodeJS.WritableStream;
    startedExecution: StartedExecution;
  }
): Promise<Awaited<ReturnType<typeof endExecution>>> {
  try {
    const exitCode = await spawnWithTee(
      state.loggedCommand.command.command,
      [...state.loggedCommand.command.prefixArgs, ...state.loggedCommand.args],
      state.output
    );

    return await endExecution(context, state.startedExecution, {
      exitCode,
      logFile: state.logFile,
      status: exitCode === 0 ? "success" : "failed"
    });
  } catch (error) {
    state.output.end();
    await endExecution(context, state.startedExecution, {
      error,
      logFile: state.logFile,
      status: "failed"
    });
    throw error;
  }
}

function toStepSummary(
  execution: Awaited<ReturnType<typeof endExecution>>,
  loggedCommand: LoggedCommand,
  logFile: string
): AuditStepSummary {
  return {
    command: execution.command ?? getCommandLine(loggedCommand),
    durationMs: execution.durationMs,
    exitCode: execution.exitCode ?? 1,
    logFile: execution.logFile ?? logFile,
    startedAt: execution.startedAt,
    status: execution.status,
    step: execution.step ?? loggedCommand.step
  };
}

function getCommandLine(loggedCommand: LoggedCommand): string[] {
  return [loggedCommand.command.command, ...loggedCommand.command.prefixArgs, ...loggedCommand.args];
}

function resolvePinnedNpmRuntime(cwd: string): ResolvedCommand | null {
  const versionFile = path.join(cwd, ".nvmrc");

  if (!existsSync(versionFile)) {
    return null;
  }

  const appData = process.env.APPDATA;
  const nvmHome = process.env.NVM_HOME;
  let nvmDirectory: string | null = null;

  if (typeof nvmHome === "string" && nvmHome.length > 0) {
    nvmDirectory = nvmHome;
  } else if (typeof appData === "string" && appData.length > 0) {
    nvmDirectory = path.join(appData, "nvm");
  }

  if (nvmDirectory === null) {
    return null;
  }

  const version = readFileSync(versionFile, "utf8").trim();
  const nodeDirectory = path.join(nvmDirectory, `v${version}`);
  const nodeExecutable = path.join(nodeDirectory, "node.exe");
  const npmCli = path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js");

  if (!existsSync(nodeExecutable) || !existsSync(npmCli)) {
    return null;
  }

  return {
    command: nodeExecutable,
    prefixArgs: [npmCli]
  };
}
