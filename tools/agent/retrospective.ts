import { createRetrospectiveArtifact } from "./lib/retrospective.js";

interface ParsedArgs {
  force: boolean;
  outputPath?: string;
  runId: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const run = await createRetrospectiveArtifact(options.runId, {
    force: options.force,
    ...(options.outputPath === undefined ? {} : { outputPath: options.outputPath })
  });

  process.stdout.write(`Created retrospective: ${run.paths.outputPath}\n`);
}

function parseArgs(rawArgs: string[]): ParsedArgs {
  let force = false;
  let outputPath: string | undefined;
  let runId: string | undefined;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index];

    if (current === "--force") {
      force = true;
      continue;
    }

    if (current === "--output") {
      outputPath = readValue(rawArgs, index, "--output");
      index += 1;
      continue;
    }

    if (current === "--run-id") {
      runId = readValue(rawArgs, index, "--run-id");
      index += 1;
      continue;
    }

    if (current === undefined) {
      throw new Error("Unknown empty argument.");
    }

    if (current.startsWith("--")) {
      throw new Error(`Unknown argument: ${current}`);
    }

    if (runId !== undefined) {
      throw new Error("Specify only one run id.");
    }

    runId = current;
  }

  if (runId === undefined) {
    throw new Error("Missing run id. Usage: npm run workflow:retro -- <run-id> [--force] [--output <path>]");
  }

  return {
    force,
    ...(outputPath === undefined ? {} : { outputPath }),
    runId
  };
}

function readValue(rawArgs: string[], index: number, flag: string): string {
  const value = rawArgs[index + 1];

  if (value === undefined) {
    throw new Error(`Missing value after ${flag}`);
  }

  return value;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
