import { spawnSync } from "child_process";
import type { PrismaClient } from "@taxes/db";
import type { WorkflowRun } from "@taxes/shared";
import { getWorkItemById } from "@taxes/plan-api";

export interface ContextPackStep {
  type: "context-pack";
  id: string;
  label: string;
  workItemId?: string;
  outputKey: string;
  includeGitDiff: boolean;
  includePreviousAttempts: boolean;
}

export interface ContextPackResult {
  workItemId: string;
  workItemTitle: string;
  workItemSummary: string;
  acceptanceCriteria: string[];
  tasks: string[];
  gitDiff: string;
  changedFiles: string[];
  previousAttemptSummary?: string;
  packedAt: string;
}

export interface ContextPackOptions {
  db: PrismaClient;
  run: WorkflowRun;
  step: ContextPackStep;
  planningDatabaseUrl: string | undefined;
}

function resolveWorkItemId(step: ContextPackStep, run: WorkflowRun): string {
  if (step.workItemId) return step.workItemId;
  const input = run.contextJson.input;
  if (input && typeof input === "object") {
    const id = (input as Record<string, unknown>).workItemId;
    if (typeof id === "string") return id;
  }
  throw new Error(
    "Unable to determine workItemId: not in step config or contextJson.input"
  );
}

function extractStringField(obj: unknown, field: string): string | undefined {
  if (obj && typeof obj === "object") {
    const val = (obj as Record<string, unknown>)[field];
    if (typeof val === "string") return val;
  }
  return undefined;
}

interface WorkItemDetails {
  workItemTitle: string;
  workItemSummary: string;
  acceptanceCriteria: string[];
  tasks: string[];
}

async function loadWorkItemDetails(workItemId: string, planningDatabaseUrl: string): Promise<WorkItemDetails> {
  const workItem = await getWorkItemById(workItemId, { databaseUrl: planningDatabaseUrl });

  if (!workItem) {
    return { workItemTitle: workItemId, workItemSummary: "", acceptanceCriteria: [], tasks: [] };
  }

  const acceptanceCriteria: string[] = [];
  if (Array.isArray(workItem.acceptanceCriteria)) {
    for (const c of workItem.acceptanceCriteria) {
      const text = extractStringField(c, "criterion");
      if (text) acceptanceCriteria.push(text);
    }
  }

  const tasks: string[] = [];
  if (Array.isArray(workItem.tasks)) {
    for (const t of workItem.tasks) {
      const text = extractStringField(t, "title");
      if (text) tasks.push(text);
    }
  }

  return {
    workItemTitle: workItem.title,
    workItemSummary: workItem.summary,
    acceptanceCriteria,
    tasks
  };
}

interface GitContext {
  gitDiff: string;
  changedFiles: string[];
}

function gatherGitContext(): GitContext {
  const changedFiles: string[] = [];
  let gitDiff = "";

  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const namesResult = spawnSync("git", ["diff", "origin/main...HEAD", "--name-only"]);
  if (namesResult.status === 0) {
    changedFiles.push(...namesResult.stdout.toString().split("\n").filter((l) => l.trim()));
  }

  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const statResult = spawnSync("git", ["diff", "origin/main...HEAD", "--stat"]);
  if (statResult.status === 0) {
    gitDiff = statResult.stdout.toString();
    if (gitDiff.length > 5000) {
      gitDiff = `${gitDiff.substring(0, 5000)}\n[... truncated ...]`;
    }
  }

  return { gitDiff, changedFiles };
}

async function loadPreviousAttemptSummary(
  db: PrismaClient,
  run: WorkflowRun,
  workItemId: string
): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const previousRun = await (db as any).workflowRun.findFirst({
    where: {
      definitionName: run.definitionName,
      status: "failed",
      contextJson: { contains: JSON.stringify(workItemId) }
    },
    orderBy: { completedAt: "desc" }
  }) as { contextJson: string | null } | null;

  const contextJson = previousRun?.contextJson;
  if (!contextJson) return undefined;

  return parsePreviousRunError(contextJson);
}

function parsePreviousRunError(contextJson: string): string | undefined {
  try {
    const ctx = JSON.parse(contextJson) as Record<string, unknown>;
    const errorVal = ctx.error;
    const message =
      typeof errorVal === "string"
        ? errorVal
        : extractStringField(errorVal, "message");
    return message ? `Previous attempt failed with error: ${message}` : undefined;
  } catch {
    return undefined;
  }
}

async function tryLoadWorkItem(workItemId: string, url: string): Promise<WorkItemDetails> {
  return loadWorkItemDetails(workItemId, url).catch((err: unknown) => {
    console.warn(`Failed to load work item ${workItemId}: ${err instanceof Error ? err.message : String(err)}`);
    return { workItemTitle: workItemId, workItemSummary: "", acceptanceCriteria: [], tasks: [] };
  });
}

async function tryLoadPreviousAttempt(db: PrismaClient, run: WorkflowRun, workItemId: string): Promise<string | undefined> {
  return loadPreviousAttemptSummary(db, run, workItemId).catch((err: unknown) => {
    console.warn(`Failed to load previous attempt: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  });
}

function tryGatherGit(): GitContext {
  try {
    return gatherGitContext();
  } catch (err) {
    console.warn(`Failed to gather git diff: ${err instanceof Error ? err.message : String(err)}`);
    return { gitDiff: "", changedFiles: [] };
  }
}

/**
 * Loads work item from planning database and gathers rich context including
 * git diff, changed files, and previous attempt history.
 */
export async function executeContextPackStep(options: ContextPackOptions): Promise<ContextPackResult> {
  const db: PrismaClient = options.db;
  const run: WorkflowRun = options.run;
  const step: ContextPackStep = options.step;
  const planningDatabaseUrl: string | undefined = options.planningDatabaseUrl;

  const workItemId = resolveWorkItemId(step, run);
  const workItemDetails = planningDatabaseUrl
    ? await tryLoadWorkItem(workItemId, planningDatabaseUrl)
    : { workItemTitle: workItemId, workItemSummary: "", acceptanceCriteria: [], tasks: [] };

  const { gitDiff, changedFiles } = step.includeGitDiff ? tryGatherGit() : { gitDiff: "", changedFiles: [] };

  const previousAttemptSummary = step.includePreviousAttempts
    ? await tryLoadPreviousAttempt(db, run, workItemId)
    : undefined;

  return {
    workItemId,
    ...workItemDetails,
    gitDiff,
    changedFiles,
    previousAttemptSummary,
    packedAt: new Date().toISOString()
  };
}
