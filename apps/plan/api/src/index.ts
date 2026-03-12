import { PLAN_API_HOST, PLAN_API_PORT, PLANNING_DATABASE_URL } from "./config.js";
import { buildApp } from "./app.js";
import { applyPendingMigrations } from "./db/migrations.js";

async function main(): Promise<void> {
  await applyPendingMigrations(PLANNING_DATABASE_URL);
  const app = await buildApp();

  try {
    await app.listen({
      host: PLAN_API_HOST,
      port: PLAN_API_PORT
    });
    process.stdout.write(`Plan API listening on http://${PLAN_API_HOST}:${PLAN_API_PORT.toString()}\n`);
  } catch (error) {
    await app.close();
    throw error;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
