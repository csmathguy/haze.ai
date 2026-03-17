import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { createDevEnvironmentPlan, parseDevEnvironmentArgs, type DevServiceLaunchPlan } from "./lib/dev-environment.js";
import { ensureMuiDependencyIntegrity } from "./lib/dependency-integrity.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDirectory, "..", "..");

interface RefreshOptions {
  branch: string;
  remote: string;
  environmentIds: string[];
  skipDev: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs();

  writeInfo("Refreshing the Taxes repository and services...");
  await runShortCommand("git fetch", "git", ["fetch", options.remote, options.branch]);
  await runShortCommand("git pull", "git", ["pull", options.remote, options.branch]);
  await runShortCommand("npm install", "node", [
    "tools/runtime/run-npm.cjs",
    "install"
  ]);
  await ensureMuiDependencyIntegrity({
    log: writeInfo,
    reinstall: async () => {
      await runShortCommand("npm install (repair)", "node", ["tools/runtime/run-npm.cjs", "install"]);
    },
    repositoryRoot
  });

  if (options.skipDev) {
    writeInfo("Skipping dev environment start (--skip-dev was provided).");
    return;
  }

  const services = getRequestedServices(options.environmentIds);
  stopExistingServicesForPorts(services);
  await startDevEnvironment(options.environmentIds);
}

function parseArgs(): RefreshOptions {
  const args = process.argv.slice(2);
  const options: RefreshOptions = {
    branch: "main",
    remote: "origin",
    environmentIds: [],
    skipDev: false
  };

  let index = 0;

  while (index < args.length) {
    const token = args[index];

    if (typeof token !== "string") {
      throw new Error("Unexpected empty argument.");
    }

    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }

    index = applyArgument(options, args, index, token) + 1;
  }

  if (options.environmentIds.length === 0) {
    options.environmentIds.push("all");
  }

  return options;
}

function applyArgument(options: RefreshOptions, args: string[], index: number, token: string): number {
  switch (token) {
    case "--branch":
      options.branch = readRequiredValue(args, index, "--branch");
      return index + 1;
    case "--remote":
      options.remote = readRequiredValue(args, index, "--remote");
      return index + 1;
    case "--environment":
    case "--env": {
      const next = readRequiredValue(args, index, token);
      options.environmentIds.push(...next.split(",").map((value) => value.trim()).filter(Boolean));
      return index + 1;
    }
    case "--skip-dev":
    case "--skip-de":
      options.skipDev = true;
      return index;
    default:
      throw new Error(`Unknown argument: ${token}`);
  }
}

function readRequiredValue(args: string[], index: number, flagName: string): string {
  const value = args[index + 1];

  if (value === undefined) {
    throw new Error(`${flagName} requires a value.`);
  }

  return value;
}

function printUsage(): void {
  writeInfo(`
Usage: npm run repo:refresh [options]

Options:
  --branch <name>            Git branch to update (default: main)
  --remote <name>            Remote name to fetch from (default: origin)
  --environment <id>         Launch this dev environment after refresh (repeatable or comma-separated; default: all)
  --env <id>                 Alias for --environment
  --skip-dev, --skip-de      Only refresh the repository/deps and skip starting services
  --help, -h                 Show this help message
`);
}

async function runShortCommand(label: string, command: string, args: string[]): Promise<void> {
  writeInfo(`Running ${label}...`);

  await runCommand(command, args).catch((error: unknown) => {
    throw new Error(`${label} failed: ${toErrorMessage(error)}`);
  });
}

async function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      stdio: "inherit",
      windowsHide: true
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Process exited with code ${String(code)}.`));
        return;
      }

      if (signal !== null) {
        reject(new Error(`Process was terminated by signal ${signal}.`));
        return;
      }

      resolve();
    });
  });
}

async function startDevEnvironment(environmentIds: string[]): Promise<void> {
  const args = [
    "tools/runtime/run-npm.cjs",
    "run",
    "dev:env",
    "--",
    ...environmentIds.flatMap((environment) => ["--environment", environment])
  ];
  writeInfo(`Starting dev environment(s): ${environmentIds.join(", ")}`);

  await runLongRunningCommand("node", args);
}

function getRequestedServices(environmentIds: string[]): DevServiceLaunchPlan[] {
  const parsed = parseDevEnvironmentArgs(
    environmentIds.flatMap((environmentId) => ["--environment", environmentId]),
    { requireEnvironmentSelection: true }
  );
  const plan = createDevEnvironmentPlan(parsed, {
    main: repositoryRoot
  });
  return plan.services;
}

function stopExistingServicesForPorts(services: readonly DevServiceLaunchPlan[]): void {
  const ports = [...new Set(services.flatMap((service) => getPortsForService(service)))];
  const stoppedPids = new Set<number>();

  for (const port of ports) {
    const processIds = getListeningProcessIds(port);

    for (const processId of processIds) {
      if (stoppedPids.has(processId)) {
        continue;
      }

      stopProcess(processId);
      stoppedPids.add(processId);
      writeInfo(`Stopped existing process ${String(processId)} on port ${String(port)}.`);
    }
  }
}

function getPortsForService(service: DevServiceLaunchPlan): number[] {
  const urls = [service.primaryUrl];

  if (service.healthUrl !== undefined) {
    urls.push(service.healthUrl);
  }

  return urls.flatMap((urlValue) => {
    const port = Number.parseInt(new URL(urlValue).port, 10);
    return Number.isNaN(port) ? [] : [port];
  });
}

function getListeningProcessIds(port: number): number[] {
  if (process.platform === "win32") {
    return getListeningProcessIdsWindows(port);
  }

  return getListeningProcessIdsPosix(port);
}

function getListeningProcessIdsWindows(port: number): number[] {
  const output = execFileSync("netstat", ["-ano"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
  const rows = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const processIds: number[] = [];

  for (const row of rows) {
    const columns = row.split(/\s+/);
    const protocol = columns[0];
    const localAddress = columns[1];
    const state = columns[3];
    const pidValue = columns[4];

    if (protocol !== "TCP" || localAddress === undefined || state !== "LISTENING" || pidValue === undefined) {
      continue;
    }

    const localPort = localAddress.split(":").at(-1);

    if (localPort !== port.toString()) {
      continue;
    }

    const processId = Number.parseInt(pidValue, 10);
    if (!Number.isNaN(processId) && processId !== process.pid) {
      processIds.push(processId);
    }
  }

  return processIds;
}

function getListeningProcessIdsPosix(port: number): number[] {
  let output: string;

  try {
    output = execFileSync("lsof", ["-ti", `tcp:${port.toString()}`], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((value) => !Number.isNaN(value) && value !== process.pid);
}

function stopProcess(processId: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", processId.toString(), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  try {
    process.kill(processId, "SIGTERM");
  } catch {
    return;
  }
}

async function runLongRunningCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      stdio: "inherit",
      windowsHide: true
    });

    attachSignalForwarding(child);

    child.once("error", (error) => {
      reject(error);
    });

    child.once("exit", (code, signal) => {
      if (code !== null) {
        process.exitCode = code;
      } else if (signal !== null) {
        process.exitCode = 1;
      }

      if (code !== null && code !== 0) {
        writeInfo(`Dev environment exited with code ${String(code)}.`);
      } else if (signal !== null) {
        writeInfo(`Dev environment terminated by signal ${signal}.`);
      }

      resolve();
    });
  });
}

function attachSignalForwarding(child: ChildProcess): void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  const handlers = signals.map((signal) => {
    const handler = () => {
      child.kill(signal);
    };
    process.on(signal, handler);
    return { signal, handler };
  });

  child.once("exit", () => {
    for (const { signal, handler } of handlers) {
      process.off(signal, handler);
    }
  });
}

function writeInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${toErrorMessage(error)}\n`);
  process.exitCode = 1;
});
