/**
 * Kills any processes listening on the gateway and workflow-web ports,
 * then starts both services via the dev-environment launcher.
 *
 * Usage: npm run gateway:restart
 */
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GATEWAY_PORT = 3000;
const WORKFLOW_WEB_PORT = 5179;

function getListeningPidsWin32(port: number): number[] {
  const output = execFileSync("netstat", ["-ano"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
  const pids: number[] = [];
  for (const row of output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const cols = row.split(/\s+/);
    const [proto, localAddr, , state, pidStr] = cols;
    if (proto !== "TCP" || state !== "LISTENING" || !localAddr || !pidStr) continue;
    if (localAddr.split(":").at(-1) !== port.toString()) continue;
    const pid = Number.parseInt(pidStr, 10);
    if (!Number.isNaN(pid) && pid !== process.pid) pids.push(pid);
  }
  return pids;
}

function getListeningPids(port: number): number[] {
  if (process.platform === "win32") {
    return getListeningPidsWin32(port);
  }
  // POSIX
  try {
    const out = execFileSync("lsof", ["-t", `-i:${port.toString()}`], { encoding: "utf8" });
    return out.split(/\s+/).map(Number).filter((n) => !Number.isNaN(n) && n > 0);
  } catch {
    return [];
  }
}

function stopPort(port: number): void {
  const pids = getListeningPids(port);
  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/pid", pid.toString(), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true
        });
      } else {
        process.kill(pid, "SIGTERM");
      }
      console.warn(`Stopped PID ${pid.toString()} on port ${port.toString()}.`);
    } catch {
      // Process may have already exited
    }
  }
}

console.warn("Stopping gateway and workflow-web services...");
stopPort(GATEWAY_PORT);
stopPort(WORKFLOW_WEB_PORT);

console.warn("Starting gateway and workflow-web services...");
const child = spawn(
  process.execPath,
  [
    path.join(REPO_ROOT, "node_modules/tsx/dist/cli.mjs"),
    path.join(REPO_ROOT, "tools/agent/dev-environment.ts"),
    "start",
    "--environment", "gateway",
    "--environment", "workflow"
  ],
  {
    cwd: REPO_ROOT,
    stdio: "inherit",
    detached: false
  }
);

child.on("error", (err) => {
  console.error("Failed to start services:", err.message);
  process.exit(1);
});
