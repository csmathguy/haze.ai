import { syncAuditEvent, syncAuditSummary } from "../../../apps/audit/api/src/services/audit-store.js";
import type { AuditSyncEvent, AuditSyncSummary } from "../../../apps/audit/api/src/services/audit-sync-contract.js";

const reportedSyncFailures = new Set<string>();

export async function syncAuditEventSafely(event: AuditSyncEvent): Promise<void> {
  try {
    await syncAuditEvent(
      event,
      process.env.AUDIT_DATABASE_URL === undefined ? {} : { databaseUrl: process.env.AUDIT_DATABASE_URL }
    );
  } catch (error) {
    reportAuditSyncFailure("event", error);
  }
}

export async function syncAuditSummarySafely(summary: AuditSyncSummary): Promise<void> {
  try {
    await syncAuditSummary(
      summary,
      process.env.AUDIT_DATABASE_URL === undefined ? {} : { databaseUrl: process.env.AUDIT_DATABASE_URL }
    );
  } catch (error) {
    reportAuditSyncFailure("summary", error);
  }
}

function reportAuditSyncFailure(kind: "event" | "summary", error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const cacheKey = `${kind}:${message}`;

  if (reportedSyncFailures.has(cacheKey)) {
    return;
  }

  reportedSyncFailures.add(cacheKey);
  process.stderr.write(`Audit ${kind} DB sync failed; file artifacts were still written. ${message}\n`);
}
