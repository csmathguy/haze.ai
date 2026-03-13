import { AUDIT_API_HOST, AUDIT_API_PORT } from "./config.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      host: AUDIT_API_HOST,
      port: AUDIT_API_PORT
    });
    process.stdout.write(`Audit API listening on http://${AUDIT_API_HOST}:${AUDIT_API_PORT.toString()}\n`);
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
