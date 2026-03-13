import { readFile } from "node:fs/promises";
import * as path from "node:path";

import {
  CreateKnowledgeEntryInputSchema,
  CreateKnowledgeSubjectInputSchema
} from "@taxes/shared";

import { KNOWLEDGE_DATABASE_URL } from "../../apps/knowledge/api/src/config.js";
import { applyPendingKnowledgeMigrations } from "../../apps/knowledge/api/src/db/migrations.js";
import {
  createKnowledgeEntry,
  createKnowledgeSubject,
  getKnowledgeWorkspace,
  importRepositoryKnowledge
} from "../../apps/knowledge/api/src/services/knowledge.js";

type CommandHandler = (args: string[]) => Promise<unknown>;

const commandHandlers = new Map<string, CommandHandler>([
  ["entry:create", handleEntryCreate],
  ["repo-docs:sync", handleRepoDocsSync],
  ["subject:create", handleSubjectCreate],
  ["workspace:get", handleWorkspaceGet]
]);

async function main(): Promise<void> {
  const [group, action, ...restArgs] = process.argv.slice(2);
  const commandKey = `${group ?? ""}:${action ?? ""}`;
  const handler = commandHandlers.get(commandKey);

  if (handler === undefined) {
    throw new Error(`Unknown command '${commandKey}'. Expected one of: ${[...commandHandlers.keys()].join(", ")}`);
  }

  await applyPendingKnowledgeMigrations(KNOWLEDGE_DATABASE_URL);
  const result = await handler(restArgs);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function handleWorkspaceGet(): Promise<Awaited<ReturnType<typeof getKnowledgeWorkspace>>> {
  return getKnowledgeWorkspace();
}

async function handleSubjectCreate(args: string[]): Promise<{ subject: Awaited<ReturnType<typeof createKnowledgeSubject>> }> {
  const input = await readJsonFileFlag(args, "--json-file", CreateKnowledgeSubjectInputSchema);

  return {
    subject: await createKnowledgeSubject(input)
  };
}

async function handleEntryCreate(args: string[]): Promise<{ entry: Awaited<ReturnType<typeof createKnowledgeEntry>> }> {
  const input = await readJsonFileFlag(args, "--json-file", CreateKnowledgeEntryInputSchema);

  return {
    entry: await createKnowledgeEntry(input)
  };
}

async function handleRepoDocsSync(): Promise<{ sync: Awaited<ReturnType<typeof importRepositoryKnowledge>> }> {
  return {
    sync: await importRepositoryKnowledge()
  };
}

function readRequiredFlag(args: string[], flagName: string): string {
  const index = args.indexOf(flagName);

  if (index === -1) {
    throw new Error(`Pass ${flagName}.`);
  }

  const value = args[index + 1];

  if (value === undefined) {
    throw new Error(`Missing value after ${flagName}.`);
  }

  return value;
}

async function readJsonFileFlag<TSchemaOutput>(
  args: string[],
  flagName: string,
  schema: { parse: (value: unknown) => TSchemaOutput }
): Promise<TSchemaOutput> {
  const filePath = readRequiredFlag(args, flagName);
  const rawContent = await readFile(path.resolve(filePath), "utf8");

  return schema.parse(JSON.parse(rawContent) as unknown);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
