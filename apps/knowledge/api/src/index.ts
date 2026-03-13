import { KNOWLEDGE_API_HOST, KNOWLEDGE_API_PORT, KNOWLEDGE_DATABASE_URL } from "./config.js";
import { buildApp } from "./app.js";
import { applyPendingKnowledgeMigrations } from "./db/migrations.js";

async function main(): Promise<void> {
  await applyPendingKnowledgeMigrations(KNOWLEDGE_DATABASE_URL);
  const app = await buildApp();

  try {
    await app.listen({
      host: KNOWLEDGE_API_HOST,
      port: KNOWLEDGE_API_PORT
    });
    process.stdout.write(`Knowledge API listening on http://${KNOWLEDGE_API_HOST}:${KNOWLEDGE_API_PORT.toString()}\n`);
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
