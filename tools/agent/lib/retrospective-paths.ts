import * as path from "node:path";

export function formatAuditLogReference(logFile: string | undefined, runDir: string): string {
  if (logFile === undefined) {
    return "the related command log";
  }

  const portableLogFile = toPortablePath(logFile);
  const portableRunDir = toPortablePath(runDir);
  const logsIndex = portableLogFile.lastIndexOf("/logs/");

  if (logsIndex >= 0) {
    return `\`${portableLogFile.slice(logsIndex + 1)}\``;
  }

  if (portableLogFile.startsWith(portableRunDir)) {
    const relativePath = portableLogFile.slice(portableRunDir.length).replace(/^\/+/u, "");
    return `\`${relativePath}\``;
  }

  return `\`${portableLogFile}\``;
}

function toPortablePath(filePath: string): string {
  return filePath.split(path.sep).join("/").replaceAll("\\", "/");
}
