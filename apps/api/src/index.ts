import { API_HOST, API_PORT } from "./config.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      host: API_HOST,
      port: API_PORT
    });
    process.stdout.write(`API listening on http://${API_HOST}:${API_PORT.toString()}\n`);
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
