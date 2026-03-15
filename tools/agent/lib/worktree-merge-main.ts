export interface MergeMainOutcome {
  message: string;
  status: "merged" | "warning";
}

export function mergeMainIntoWorktree(
  worktreePath: string,
  runGit: (args: string[], cwd: string) => string
): MergeMainOutcome {
  try {
    runGit(["fetch", "origin"], worktreePath);
    const mergeOutput = runGit(["merge", "origin/main"], worktreePath);

    return {
      message: formatMergeMainSuccess(mergeOutput),
      status: "merged"
    };
  } catch (error: unknown) {
    return {
      message: formatMergeMainFailure(error),
      status: "warning"
    };
  }
}

function formatMergeMainSuccess(mergeOutput: string): string {
  const firstLine = mergeOutput
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? "merge completed";
}

function formatMergeMainFailure(error: unknown): string {
  const commandOutput = readCommandOutput(error);

  if (commandOutput !== undefined) {
    return commandOutput;
  }

  return error instanceof Error ? error.message : String(error);
}

function readCommandOutput(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const record = error as { stderr?: unknown; stdout?: unknown };

  return normalizeCommandOutput(record.stderr) ?? normalizeCommandOutput(record.stdout);
}

function normalizeCommandOutput(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const firstLine = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? undefined;
}
