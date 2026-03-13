import * as os from "node:os";
import * as path from "node:path";

export const AUDIT_API_HOST = process.env.AUDIT_API_HOST ?? "127.0.0.1";
export const AUDIT_API_PORT = Number(process.env.AUDIT_API_PORT ?? "3180");
export const AUDIT_STREAM_POLL_INTERVAL_MS = 1000;
export const AUDIT_DATABASE_URL = process.env.AUDIT_DATABASE_URL ?? buildAuditDatabaseUrl(resolveDefaultAuditDatabasePath());

export function resolveDefaultAuditDatabasePath(): string {
  return path.join(os.homedir(), ".taxes", "audit", "sqlite", "audit.db");
}

export function buildAuditDatabaseUrl(databaseFilePath: string): string {
  const normalizedPath = path.resolve(databaseFilePath).replaceAll("\\", "/");
  return `file:/${normalizedPath}`;
}
