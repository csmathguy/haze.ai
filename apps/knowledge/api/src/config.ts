import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export const KNOWLEDGE_API_HOST = "127.0.0.1";
export const KNOWLEDGE_API_PORT = 3240;
export const KNOWLEDGE_DATA_ROOT = path.join(os.homedir(), ".taxes", "knowledge");
export const KNOWLEDGE_DATABASE_URL =
  process.env.KNOWLEDGE_DATABASE_URL ?? createAbsoluteSqliteUrl(path.join(KNOWLEDGE_DATA_ROOT, "sqlite", "knowledge.db"));
export const REPOSITORY_DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../docs");

function createAbsoluteSqliteUrl(databaseFilePath: string): string {
  const normalizedPath = path.resolve(databaseFilePath).replaceAll("\\", "/");

  return /^[A-Za-z]:\//u.test(normalizedPath) ? `file:/${normalizedPath}` : `file:${normalizedPath}`;
}
