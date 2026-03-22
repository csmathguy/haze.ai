import * as os from "node:os";
import * as path from "node:path";

export const CODE_REVIEW_API_HOST = "127.0.0.1";
export const CODE_REVIEW_API_PORT = 3142;
export const CODE_REVIEW_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
export const CODE_REVIEW_CACHE_ROOT = path.resolve("artifacts", "code-review-cache");
export const CODE_REVIEW_WORKFLOW_DATABASE_URL =
  process.env.WORKFLOW_DATABASE_URL ?? buildWorkflowDatabaseUrl(resolveDefaultWorkflowDatabasePath());

function resolveDefaultWorkflowDatabasePath(): string {
  return path.join(os.homedir(), ".taxes", "workflow", "sqlite", "workflow.db");
}

function buildWorkflowDatabaseUrl(databaseFilePath: string): string {
  const normalizedPath = path.resolve(databaseFilePath).replaceAll("\\", "/");

  return `file:/${normalizedPath}`;
}
