import { listActiveHeartbeatEvents } from "../../apps/audit/api/src/services/heartbeat-store.js";
import type { HeartbeatEventRow } from "../../apps/audit/api/src/services/heartbeat-store.js";

const POLL_INTERVAL_MS = 5_000;
const RUN_ID_SHORT_LENGTH = 8;

async function renderProgress(): Promise<void> {
  try {
    const options =
      process.env.AUDIT_DATABASE_URL === undefined ? {} : { databaseUrl: process.env.AUDIT_DATABASE_URL };
    const rows = await listActiveHeartbeatEvents(options);

    process.stdout.write("\x1Bc"); // clear screen
    process.stdout.write("audit:progress — heartbeats for active runs (refreshing every 5s, Ctrl+C to exit)\n");
    printHeader();

    if (rows.length === 0) {
      process.stdout.write("  (no heartbeats from active runs yet)\n");
    } else {
      for (const row of rows) {
        process.stdout.write(`${formatRow(row)}\n`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error fetching heartbeats: ${message}\n`);
  }
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 23);
}

function formatRow(row: HeartbeatEventRow): string {
  const ts = formatTimestamp(row.createdAt);
  const runIdShort = row.runId.slice(0, RUN_ID_SHORT_LENGTH);
  const workItem = row.workItemId ?? "-";
  return `${ts}  ${runIdShort}  ${workItem.padEnd(12)}  ${row.message}`;
}

function printHeader(): void {
  const header = `${"TIMESTAMP".padEnd(23)}  ${"RUN".padEnd(8)}  ${"WORK ITEM".padEnd(12)}  MESSAGE`;
  const divider = "-".repeat(header.length);
  process.stdout.write(`\n${header}\n${divider}\n`);
}

async function main(): Promise<void> {
  await renderProgress();
  const timer = setInterval(() => {
    void renderProgress();
  }, POLL_INTERVAL_MS);

  process.on("SIGINT", () => {
    clearInterval(timer);
    process.stdout.write("\nStopped.\n");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    clearInterval(timer);
    process.exit(0);
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
