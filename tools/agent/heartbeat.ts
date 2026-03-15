import { writeHeartbeatEvent } from "../../apps/audit/api/src/services/heartbeat-store.js";
import { readAgentSession } from "./lib/session.js";

async function main(): Promise<void> {
  const message = parseMessage(process.argv.slice(2));
  const session = await readAgentSession();

  if (session === undefined) {
    process.stderr.write("Warning: .agent-session.json not found. Heartbeat skipped.\n");
    return;
  }

  const options =
    process.env.AUDIT_DATABASE_URL === undefined ? {} : { databaseUrl: process.env.AUDIT_DATABASE_URL };

  await writeHeartbeatEvent(
    {
      message,
      runId: session.runId,
      ...(session.workItemId === undefined ? {} : { workItemId: session.workItemId })
    },
    options
  );

  process.stdout.write(`Heartbeat logged for run ${session.runId}: ${message}\n`);
}

function parseMessage(rawArgs: string[]): string {
  for (let index = 0; index < rawArgs.length; index += 1) {
    if (rawArgs[index] === "--message") {
      const value = rawArgs[index + 1];

      if (value === undefined || value.trim().length === 0) {
        throw new Error("Missing value after --message.");
      }

      return value;
    }
  }

  throw new Error("Missing required argument --message. Usage: npm run agent:heartbeat -- --message '<text>'");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
