import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { AuditExecutionKind, AuditMetadata } from "./audit.js";

const ACTIVE_RUNS_PATH = path.resolve("artifacts", "audit", "active-runs.json");
const ACTIVE_RUNS_LOCK_PATH = path.resolve("artifacts", "audit", "active-runs.lock");
const ACTIVE_RUNS_LOCK_RETRY_MS = 50;
const ACTIVE_RUNS_LOCK_TIMEOUT_MS = 5_000;
const ACTIVE_RUNS_LOCK_STALE_MS = 30_000;

export interface ActiveExecutionRecord {
  command?: string[];
  executionId: string;
  kind: AuditExecutionKind;
  metadata?: AuditMetadata;
  name: string;
  parentExecutionId?: string;
  startedAt: string;
  step?: string;
}

interface ActiveRunRecord {
  executions: Record<string, ActiveExecutionRecord>;
  runId: string;
  startedAt: string;
  task?: string;
}

type ActiveRuns = Record<string, Record<string, ActiveRunRecord>>;
type RawActiveRunRecord = Omit<ActiveRunRecord, "executions"> & {
  executions?: Record<string, ActiveExecutionRecord>;
};
type RawActiveRuns = Record<string, Record<string, RawActiveRunRecord>>;

export async function setActiveRun(workflow: string, runId: string, task?: string): Promise<void> {
  await mutateActiveRuns((activeRuns) => {
    const cwd = process.cwd();
    const existingRun = activeRuns[cwd]?.[workflow];
    const runsForCwd = activeRuns[cwd] ?? {};

    runsForCwd[workflow] = {
      executions: existingRun?.runId === runId ? existingRun.executions : {},
      runId,
      startedAt: new Date().toISOString(),
      ...(task === undefined ? {} : { task })
    };

    activeRuns[cwd] = runsForCwd;
  });
}

export async function getActiveRunId(workflow: string): Promise<string | null> {
  return withLoadedActiveRuns((activeRuns) => {
    const cwd = process.cwd();
    const runsForCwd = activeRuns[cwd];

    if (runsForCwd === undefined) {
      return null;
    }

    return runsForCwd[workflow]?.runId ?? null;
  });
}

export async function clearActiveRun(workflow: string): Promise<void> {
  await mutateActiveRuns((activeRuns) => {
    const cwd = process.cwd();
    const runsForCwd = activeRuns[cwd];

    if (runsForCwd === undefined) {
      return;
    }

    activeRuns[cwd] = Object.fromEntries(
      Object.entries(runsForCwd).filter(([candidateWorkflow]) => candidateWorkflow !== workflow)
    );
  });
}

export async function setActiveExecution(workflow: string, execution: ActiveExecutionRecord): Promise<void> {
  await mutateActiveRuns((activeRuns) => {
    const cwd = process.cwd();
    const activeRun = activeRuns[cwd]?.[workflow];

    if (activeRun === undefined) {
      throw new Error(`No active workflow found for "${workflow}". Run workflow:start first.`);
    }

    activeRun.executions[execution.executionId] = execution;
  });
}

export async function getActiveExecution(
  workflow: string,
  executionId: string
): Promise<ActiveExecutionRecord | null> {
  return withLoadedActiveRuns((activeRuns) => {
    const cwd = process.cwd();
    const activeRun = activeRuns[cwd]?.[workflow];

    if (activeRun === undefined) {
      return null;
    }

    return activeRun.executions[executionId] ?? null;
  });
}

export async function clearActiveExecution(workflow: string, executionId: string): Promise<void> {
  await mutateActiveRuns((activeRuns) => {
    const cwd = process.cwd();
    const activeRun = activeRuns[cwd]?.[workflow];

    if (activeRun === undefined) {
      return;
    }

    activeRun.executions = Object.fromEntries(
      Object.entries(activeRun.executions).filter(([candidateExecutionId]) => candidateExecutionId !== executionId)
    );
  });
}

async function withLoadedActiveRuns<TResult>(reader: (activeRuns: ActiveRuns) => TResult | Promise<TResult>): Promise<TResult> {
  return withActiveRunsLock(async () => reader(await readActiveRunsLocked()));
}

async function mutateActiveRuns(mutator: (activeRuns: ActiveRuns) => void | Promise<void>): Promise<void> {
  await withActiveRunsLock(async () => {
    const activeRuns = await readActiveRunsLocked();

    await mutator(activeRuns);
    await writeActiveRuns(activeRuns);
  });
}

async function readActiveRunsLocked(): Promise<ActiveRuns> {
  try {
    const contents = await readFile(ACTIVE_RUNS_PATH, "utf8");
    return normalizeActiveRuns(JSON.parse(contents) as RawActiveRuns);
  } catch (error) {
    if (isMissingFile(error)) {
      return {};
    }

    if (isJsonSyntaxError(error)) {
      await quarantineCorruptActiveRuns();
      await writeActiveRuns({});
      return {};
    }

    throw error;
  }
}

async function writeActiveRuns(activeRuns: ActiveRuns): Promise<void> {
  await mkdir(path.dirname(ACTIVE_RUNS_PATH), { recursive: true });
  await writeFile(ACTIVE_RUNS_PATH, `${JSON.stringify(activeRuns, null, 2)}\n`);
}

async function withActiveRunsLock<TResult>(callback: () => Promise<TResult>): Promise<TResult> {
  await mkdir(path.dirname(ACTIVE_RUNS_LOCK_PATH), { recursive: true });
  await acquireActiveRunsLock();

  try {
    return await callback();
  } finally {
    await rm(ACTIVE_RUNS_LOCK_PATH, { force: true, recursive: true });
  }
}

async function acquireActiveRunsLock(): Promise<void> {
  const deadline = Date.now() + ACTIVE_RUNS_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      await mkdir(ACTIVE_RUNS_LOCK_PATH);
      return;
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }

      if (await isStaleLockDirectory()) {
        await rm(ACTIVE_RUNS_LOCK_PATH, { force: true, recursive: true });
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${ACTIVE_RUNS_LOCK_PATH}.`);
      }

      await wait(ACTIVE_RUNS_LOCK_RETRY_MS);
    }
  }
}

async function isStaleLockDirectory(): Promise<boolean> {
  try {
    const stats = await lstat(ACTIVE_RUNS_LOCK_PATH);
    return Date.now() - stats.mtimeMs >= ACTIVE_RUNS_LOCK_STALE_MS;
  } catch (error) {
    if (isMissingFile(error)) {
      return false;
    }

    throw error;
  }
}

async function quarantineCorruptActiveRuns(): Promise<void> {
  const corruptPath = path.resolve(
    "artifacts",
    "audit",
    `active-runs.corrupt-${new Date().toISOString().replaceAll(":", "").replaceAll(".", "-")}.json`
  );

  await mkdir(path.dirname(corruptPath), { recursive: true });
  await rename(ACTIVE_RUNS_PATH, corruptPath);
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function isJsonSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

function normalizeActiveRuns(activeRuns: RawActiveRuns): ActiveRuns {
  return Object.fromEntries(
    Object.entries(activeRuns).map(([cwd, runsForCwd]) => [cwd, normalizeRunsForCwd(runsForCwd)])
  );
}

function normalizeRunsForCwd(runsForCwd: Record<string, RawActiveRunRecord>): Record<string, ActiveRunRecord> {
  return Object.fromEntries(
    Object.entries(runsForCwd).map(([workflow, activeRun]) => [
      workflow,
      {
        ...activeRun,
        executions: activeRun.executions ?? {}
      }
    ])
  );
}
