import { execFileSync, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

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

export function stopServices(children: readonly ChildProcess[]): void {
  for (const child of children) {
    stopServiceProcess(child);
  }
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
