import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { CodeReviewPullRequestDetail, CodeReviewWorkspace } from "@taxes/shared";
import { CodeReviewPullRequestDetailSchema, CodeReviewWorkspaceSchema } from "@taxes/shared";

interface CacheEntry<TValue> {
  readonly cachedAt: string;
  readonly value: TValue;
}

export interface CodeReviewCacheStore {
  readPullRequestDetail(pullRequestNumber: number): Promise<CacheEntry<CodeReviewPullRequestDetail> | null>;
  readWorkspace(): Promise<CacheEntry<CodeReviewWorkspace> | null>;
  writePullRequestDetail(pullRequestNumber: number, detail: CodeReviewPullRequestDetail): Promise<void>;
  writeWorkspace(workspace: CodeReviewWorkspace): Promise<void>;
}

export function createFileCodeReviewCacheStore(cacheRoot: string, now: () => Date = () => new Date()): CodeReviewCacheStore {
  return {
    readPullRequestDetail: async (pullRequestNumber) =>
      readCacheFile(path.join(cacheRoot, "pull-requests", `${pullRequestNumber.toString()}.json`), CodeReviewPullRequestDetailSchema),
    readWorkspace: async () => readCacheFile(path.join(cacheRoot, "workspace.json"), CodeReviewWorkspaceSchema),
    writePullRequestDetail: async (pullRequestNumber, detail) =>
      writeCacheFile(path.join(cacheRoot, "pull-requests", `${pullRequestNumber.toString()}.json`), detail, now),
    writeWorkspace: async (workspace) => writeCacheFile(path.join(cacheRoot, "workspace.json"), workspace, now)
  };
}

async function readCacheFile<TValue>(
  filePath: string,
  schema: { parse: (value: unknown) => TValue }
): Promise<CacheEntry<TValue> | null> {
  try {
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents) as { cachedAt?: unknown; value?: unknown };

    if (typeof parsed.cachedAt !== "string") {
      return null;
    }

    return {
      cachedAt: parsed.cachedAt,
      value: schema.parse(parsed.value)
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    return null;
  }
}

async function writeCacheFile(filePath: string, value: unknown, now: () => Date): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        cachedAt: now().toISOString(),
        value
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
