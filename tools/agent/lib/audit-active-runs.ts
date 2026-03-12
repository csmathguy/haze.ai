import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import type { AuditExecutionKind, AuditMetadata } from "./audit.js";

const ACTIVE_RUNS_PATH = path.resolve("artifacts", "audit", "active-runs.json");

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
  const activeRuns = await readActiveRuns();
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
  await writeActiveRuns(activeRuns);
}

export async function getActiveRunId(workflow: string): Promise<string | null> {
  const activeRuns = await readActiveRuns();
  const cwd = process.cwd();
  const runsForCwd = activeRuns[cwd];

  if (runsForCwd === undefined) {
    return null;
  }

  return runsForCwd[workflow]?.runId ?? null;
}

export async function clearActiveRun(workflow: string): Promise<void> {
  const activeRuns = await readActiveRuns();
  const cwd = process.cwd();
  const runsForCwd = activeRuns[cwd];

  if (runsForCwd === undefined) {
    return;
  }

  activeRuns[cwd] = Object.fromEntries(
    Object.entries(runsForCwd).filter(([candidateWorkflow]) => candidateWorkflow !== workflow)
  );
  await writeActiveRuns(activeRuns);
}

export async function setActiveExecution(workflow: string, execution: ActiveExecutionRecord): Promise<void> {
  const activeRuns = await readActiveRuns();
  const cwd = process.cwd();
  const activeRun = activeRuns[cwd]?.[workflow];

  if (activeRun === undefined) {
    throw new Error(`No active workflow found for "${workflow}". Run workflow:start first.`);
  }

  activeRun.executions[execution.executionId] = execution;
  await writeActiveRuns(activeRuns);
}

export async function getActiveExecution(
  workflow: string,
  executionId: string
): Promise<ActiveExecutionRecord | null> {
  const activeRuns = await readActiveRuns();
  const cwd = process.cwd();
  const activeRun = activeRuns[cwd]?.[workflow];

  if (activeRun === undefined) {
    return null;
  }

  return activeRun.executions[executionId] ?? null;
}

export async function clearActiveExecution(workflow: string, executionId: string): Promise<void> {
  const activeRuns = await readActiveRuns();
  const cwd = process.cwd();
  const activeRun = activeRuns[cwd]?.[workflow];

  if (activeRun === undefined) {
    return;
  }

  activeRun.executions = Object.fromEntries(
    Object.entries(activeRun.executions).filter(([candidateExecutionId]) => candidateExecutionId !== executionId)
  );
  await writeActiveRuns(activeRuns);
}

async function readActiveRuns(): Promise<ActiveRuns> {
  try {
    const contents = await readFile(ACTIVE_RUNS_PATH, "utf8");
    return normalizeActiveRuns(JSON.parse(contents) as RawActiveRuns);
  } catch (error) {
    if (isMissingFile(error)) {
      return {};
    }

    throw error;
  }
}

async function writeActiveRuns(activeRuns: ActiveRuns): Promise<void> {
  await mkdir(path.dirname(ACTIVE_RUNS_PATH), { recursive: true });
  await writeFile(ACTIVE_RUNS_PATH, `${JSON.stringify(activeRuns, null, 2)}\n`);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
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
