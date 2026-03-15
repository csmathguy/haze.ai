import { readFile } from "node:fs/promises";
import * as path from "node:path";

export function readOptionalFlag(args: string[], flagName: string): string | undefined {
  const index = args.indexOf(flagName);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (value === undefined) {
    throw new Error(`Missing value after ${flagName}.`);
  }

  return value;
}

export function readRequiredFlag(args: string[], flagName: string): string {
  const value = readOptionalFlag(args, flagName);

  if (value === undefined) {
    throw new Error(`Pass ${flagName}.`);
  }

  return value;
}

export function readRequiredPositionalOrFlag(args: string[], position: number, flagName: string, errorMessage: string): string {
  const positionalValue = args[position];

  if (positionalValue !== undefined && !positionalValue.startsWith("--")) {
    return positionalValue;
  }

  const flagValue = readOptionalFlag(args, flagName);

  if (flagValue !== undefined) {
    return flagValue;
  }

  throw new Error(errorMessage);
}

export async function readJsonFileFlag<TSchemaOutput>(
  args: string[],
  flagName: string,
  schema: { parse: (value: unknown) => TSchemaOutput }
): Promise<TSchemaOutput> {
  const filePath = readRequiredFlag(args, flagName);
  const rawContent = await readFile(path.resolve(filePath), "utf8");

  return schema.parse(JSON.parse(rawContent) as unknown);
}

export function formatUnknownCommandError(commandKey: string, validCommandKeys: Iterable<string>): string {
  const commandList = [...validCommandKeys].join("\n- ");

  return `Unknown command '${commandKey}'.\nValid commands:\n- ${commandList}`;
}
