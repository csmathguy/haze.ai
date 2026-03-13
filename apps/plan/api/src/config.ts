import * as os from "node:os";
import * as path from "node:path";

export const PLAN_API_HOST = "127.0.0.1";
export const PLAN_API_PORT = 3140;
export const PLAN_DATA_ROOT = path.join(os.homedir(), ".taxes", "planning");
export const PLANNING_DATABASE_URL =
  process.env.PLANNING_DATABASE_URL ?? createAbsoluteSqliteUrl(path.join(PLAN_DATA_ROOT, "sqlite", "planning.db"));

function createAbsoluteSqliteUrl(databaseFilePath: string): string {
  const normalizedPath = path.resolve(databaseFilePath).replaceAll("\\", "/");

  return /^[A-Za-z]:\//u.test(normalizedPath) ? `file:/${normalizedPath}` : `file:${normalizedPath}`;
}
