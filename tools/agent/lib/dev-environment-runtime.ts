import { execFileSync, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import * as path from "node:path";
import * as readline from "node:readline";

const DEFAULT_HEALTH_POLL_INTERVAL_MS = 500;
const DEFAULT_HEALTH_TIMEOUT_MS = 30_000;

interface WaitForServiceHealthOptions {
  fetchFn?: typeof fetch;
  healthUrl?: string;
  intervalMs?: number;
  serviceLabel: string;
  timeoutMs?: number;
}

interface PlannedServicePort {
  label: string;
  primaryUrl: string;
}

export function createShutdownSignal(): {
  promise: Promise<NodeJS.Signals>;
} {
  return {
    promise: new Promise<NodeJS.Signals>((resolve) => {
      let settled = false;
      const handler = (signal: NodeJS.Signals) => {
        if (settled) {
          return;
        }

        settled = true;
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);
        resolve(signal);
      };
      const onSigint = () => {
        handler("SIGINT");
      };
      const onSigterm = () => {
        handler("SIGTERM");
      };

      process.on("SIGINT", onSigint);
      process.on("SIGTERM", onSigterm);
    })
  };
}

export function ensureCheckoutPrerequisites(checkoutRoot: string): void {
  const runtimeEntrypoint = path.join(checkoutRoot, "tools", "runtime", "run-npm.cjs");
  const nodeModulesDirectory = path.join(checkoutRoot, "node_modules");

  if (!existsSync(runtimeEntrypoint) || !existsSync(nodeModulesDirectory)) {
    throw new Error(
      `The main checkout at ${checkoutRoot} is not ready for development commands. Run npm install in that checkout first.`
    );
  }
}

export function pipePrefixedOutput(
  input: NodeJS.ReadableStream,
  target: NodeJS.WritableStream,
  logOutput: NodeJS.WritableStream,
  serviceId: string
): void {
  const prefix = `[${serviceId}] `;
  const lineReader = readline.createInterface({
    input,
    terminal: false
  });

  lineReader.on("line", (line) => {
    const rendered = `${prefix}${line}`;
    target.write(`${rendered}\n`);
    logOutput.write(`${rendered}\n`);
  });
}

export function resolveMainCheckoutRoot(cwd: string): string {
  const gitCommonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();

  return path.dirname(gitCommonDir);
}

export function sanitizeEnv(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]]))
  );
}

export async function ensureServicePortsAvailable(
  services: readonly PlannedServicePort[],
  options: {
    createServerFn?: typeof createServer;
  } = {}
): Promise<void> {
  const createServerFn = options.createServerFn ?? createServer;

  for (const service of services) {
    const endpoint = resolvePortEndpoint(service.primaryUrl);

    if (endpoint === null) {
      continue;
    }

    await assertPortAvailable(endpoint, service.label, createServerFn);
  }
}

export async function waitForServiceHealth(options: WaitForServiceHealthOptions): Promise<void> {
  if (options.healthUrl === undefined) {
    return;
  }

  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_HEALTH_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  let lastError = "No response received.";

  while (Date.now() <= deadline) {
    try {
      const response = await fetchFn(options.healthUrl);

      if (response.ok) {
        return;
      }

      lastError = `HTTP ${response.status.toString()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await wait(intervalMs);
  }

  throw new Error(
    `${options.serviceLabel} did not become healthy at ${options.healthUrl} within ${timeoutMs.toString()}ms. Last error: ${lastError}`
  );
}

export function stopServices(children: readonly ChildProcess[]): void {
  for (const child of children) {
    stopServiceProcess(child);
  }
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function assertPortAvailable(
  endpoint: {
    host: string;
    port: number;
  },
  serviceLabel: string,
  createServerFn: typeof createServer
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServerFn();

    server.unref();
    server.once("error", (error) => {
      reject(formatPortAvailabilityError(error, endpoint, serviceLabel));
    });
    server.listen(endpoint.port, endpoint.host, () => {
      server.close((closeError) => {
        if (closeError === undefined) {
          resolve();
          return;
        }

        reject(closeError);
      });
    });
  });
}

function formatPortAvailabilityError(
  error: unknown,
  endpoint: {
    host: string;
    port: number;
  },
  serviceLabel: string
): Error {
  if (isAddressInUseError(error)) {
    return new Error(
      `${serviceLabel} cannot start because ${endpoint.host}:${endpoint.port.toString()} is already in use. ` +
      "Stop the existing process on that port or choose a different dev port before launching the environment."
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

function isAddressInUseError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EADDRINUSE";
}

function resolvePortEndpoint(primaryUrl: string): {
  host: string;
  port: number;
} | null {
  const url = new URL(primaryUrl);
  const protocol = url.protocol;

  if (protocol !== "http:" && protocol !== "https:") {
    return null;
  }

  const defaultPort = protocol === "https:" ? 443 : 80;
  const port = url.port.length > 0 ? Number(url.port) : defaultPort;

  return {
    host: url.hostname,
    port
  };
}

function stopServiceProcess(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", child.pid.toString(), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      return;
    }
  }
}
