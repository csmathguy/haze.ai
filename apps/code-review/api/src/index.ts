import { CODE_REVIEW_API_HOST, CODE_REVIEW_API_PORT } from "./config.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({
      host: CODE_REVIEW_API_HOST,
      port: CODE_REVIEW_API_PORT
    });
    process.stdout.write(`Code Review API listening on http://${CODE_REVIEW_API_HOST}:${CODE_REVIEW_API_PORT.toString()}\n`);
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
