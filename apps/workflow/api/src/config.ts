import * as os from "node:os";
import * as path from "node:path";

export const WORKFLOW_API_HOST = process.env.WORKFLOW_API_HOST ?? "127.0.0.1";
export const WORKFLOW_API_PORT = Number(process.env.WORKFLOW_API_PORT ?? "3181");
export const WORKFLOW_DATABASE_URL = process.env.WORKFLOW_DATABASE_URL ?? buildWorkflowDatabaseUrl(resolveDefaultWorkflowDatabasePath());
export const PLANNING_DATABASE_URL = process.env.PLANNING_DATABASE_URL ?? buildWorkflowDatabaseUrl(
  path.join(os.homedir(), ".taxes", "planning", "sqlite", "planning.db")
);

export function resolveDefaultWorkflowDatabasePath(): string {
  return path.join(os.homedir(), ".taxes", "workflow", "sqlite", "workflow.db");
}

export function buildWorkflowDatabaseUrl(databaseFilePath: string): string {
  const normalizedPath = path.resolve(databaseFilePath).replaceAll("\\", "/");
  return `file:/${normalizedPath}`;
}
