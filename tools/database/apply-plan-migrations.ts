import { PLANNING_DATABASE_URL } from "../../apps/plan/api/src/config.js";
import { applyPendingMigrations } from "../../apps/plan/api/src/db/migrations.js";

async function main(): Promise<void> {
  const appliedCount = await applyPendingMigrations(PLANNING_DATABASE_URL);
  process.stdout.write(`Applied ${appliedCount.toString()} pending planning migration(s).\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
