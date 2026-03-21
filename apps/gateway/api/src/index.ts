import {
  AUDIT_DATABASE_URL,
  GATEWAY_HOST,
  GATEWAY_PORT,
  KNOWLEDGE_DATABASE_URL,
  PLANNING_DATABASE_URL,
  TAXES_DATABASE_URL,
  WORKFLOW_DATABASE_URL
} from "./config.js";
import { buildGatewayApp } from "./app.js";
import { applyPendingMigrations } from "./db/migrations.js";

async function main(): Promise<void> {
  await applyPendingMigrations(TAXES_DATABASE_URL);
  await applyPendingMigrations(AUDIT_DATABASE_URL);
  await applyPendingMigrations(PLANNING_DATABASE_URL);
  await applyPendingMigrations(KNOWLEDGE_DATABASE_URL);
  await applyPendingMigrations(WORKFLOW_DATABASE_URL);

  const app = await buildGatewayApp();

  try {
    await app.listen({ host: GATEWAY_HOST, port: GATEWAY_PORT });
    process.stdout.write(`Gateway API listening on http://${GATEWAY_HOST}:${GATEWAY_PORT.toString()}\n`);
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
