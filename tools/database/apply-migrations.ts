import { DATABASE_URL } from "../../apps/taxes/api/src/config.js";
import { applyPendingMigrations } from "../../apps/taxes/api/src/db/migrations.js";

async function main(): Promise<void> {
  const appliedCount = await applyPendingMigrations(DATABASE_URL);
  process.stdout.write(`Applied ${appliedCount.toString()} pending migration(s).\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
