const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const WORKSPACE_DEV_PORTS = {
  "@taxes/api": 3040,
  "@taxes/audit-api": 3180,
  "@taxes/audit-web": 5174,
  "@taxes/code-review-api": 3142,
  "@taxes/code-review-web": 5178,
  "@taxes/gateway-api": 3000,
  "@taxes/knowledge-api": 3240,
  "@taxes/knowledge-web": 5177,
  "@taxes/plan-api": 3140,
  "@taxes/plan-web": 5175,
  "@taxes/web": 5173,
  "@taxes/workflow-api": 3181,
  "@taxes/workflow-web": 5179
};

const repositoryRoot = path.resolve(__dirname, "..", "..");
const pinnedVersion = readPinnedVersion(repositoryRoot);
const runtime = resolveRuntime(pinnedVersion);
const npmArgs = process.argv.slice(2);

reclaimDevPortsIfNeeded(npmArgs);

const result = spawnSync(runtime.nodeExecutable, [runtime.npmCli, ...npmArgs], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  windowsHide: true
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

function readPinnedVersion(rootDirectory) {
  const versionFile = path.join(rootDirectory, ".nvmrc");
  return fs.readFileSync(versionFile, "utf8").trim();
}

function resolveRuntime(version) {
  const nvmHome = process.env.NVM_HOME;
  const appData = process.env.APPDATA;
  const nvmDirectory =
    typeof nvmHome === "string" && nvmHome.length > 0
      ? nvmHome
      : typeof appData === "string" && appData.length > 0
        ? path.join(appData, "nvm")
        : null;

  if (nvmDirectory !== null) {
    const nodeDirectory = path.join(nvmDirectory, `v${version}`);
    const nodeExecutable = path.join(nodeDirectory, "node.exe");
    const npmCli = path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js");

    if (fs.existsSync(nodeExecutable) && fs.existsSync(npmCli)) {
      return {
        nodeExecutable,
        npmCli
      };
    }
  }

  if (typeof process.env.npm_execpath === "string" && process.env.npm_execpath.length > 0) {
    return {
      nodeExecutable: process.execPath,
      npmCli: process.env.npm_execpath
    };
  }

  throw new Error(
    `Pinned Node.js ${version} was not found. Install it under nvm or update .nvmrc to a locally available runtime.`
  );
}

function reclaimDevPortsIfNeeded(npmArgs) {
  if (!isWorkspaceDevCommand(npmArgs)) {
    return;
  }

  const workspace = readWorkspaceName(npmArgs);

  if (workspace === null) {
    return;
  }

  const port = WORKSPACE_DEV_PORTS[workspace];

  if (port === undefined) {
    return;
  }

  terminateProcessOnPort(port);
}

function isWorkspaceDevCommand(npmArgs) {
  return npmArgs[0] === "run" && npmArgs[1] === "dev";
}

function readWorkspaceName(npmArgs) {
  for (let index = 0; index < npmArgs.length; index += 1) {
    const current = npmArgs[index];

    if (current === "-w" || current === "--workspace") {
      return npmArgs[index + 1] ?? null;
    }

    if (typeof current === "string" && current.startsWith("--workspace=")) {
      return current.slice("--workspace=".length);
    }
  }

  return null;
}

function terminateProcessOnPort(port) {
  if (process.platform === "win32") {
    const lookup = spawnSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port.toString()} -State Listen | Select-Object -ExpandProperty OwningProcess`
    ], {
      encoding: "utf8",
      windowsHide: true
    });
    const processIds = parseProcessIds(lookup.stdout);

    for (const processId of processIds) {
      if (processId === process.pid) {
        continue;
      }

      spawnSync("taskkill.exe", ["/PID", processId.toString(), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
    }

    return;
  }

  spawnSync("bash", [
    "-lc",
    `lsof -ti tcp:${port.toString()} | xargs -r kill -TERM`
  ], {
    stdio: "ignore",
    windowsHide: true
  });
}

function parseProcessIds(stdout) {
  return stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => /^\d+$/u.test(value))
    .map((value) => Number.parseInt(value, 10));
}
