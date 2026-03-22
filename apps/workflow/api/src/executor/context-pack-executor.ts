import { spawnSync } from "child_process";
import type { PrismaClient } from "@taxes/db";
import type { ContextPackStep, WorkflowRun } from "@taxes/shared";

export interface ContextPackResult {
  workItemId: string;
  workItemTitle: string;
  workItemSummary: string;
  acceptanceCriteria: string[];
  tasks: string[];
  gitDiff: string; // truncated to 5000 chars if necessary
  changedFiles: string[]; // list of changed file paths
  previousAttemptSummary?: string; // summary of last failed run if available
  packedAt: string; // ISO timestamp
}

interface WorkItemContext {
  title: string;
  summary: string;
  acceptanceCriteria: string[];
  tasks: string[];
}

interface ContextPackInput {
  readonly db: PrismaClient;
  readonly run: WorkflowRun;
  readonly step: ContextPackStep;
  readonly planningDatabaseUrl: string | undefined;
}

function resolveWorkItemId(step: ContextPackStep, run: WorkflowRun): string {
  if (step.workItemId) return step.workItemId;
  const input = (run.contextJson as Record<string, unknown> | null)?.input as Record<string, unknown> | undefined;
  const id = input?.workItemId;
  if (typeof id === "string") return id;
  throw new Error(
    "Unable to determine workItemId: not provided in step config and not found in contextJson.input"
  );
}

function extractStrings(arr: unknown[], key: string): string[] {
  const result: string[] = [];
  for (const item of arr) {
    if (item !== null && typeof item === "object") {
      const value = (item as Record<string, unknown>)[key];
      if (typeof value === "string") result.push(value);
    }
  }
  return result;
}

async function loadWorkItemDetails(
  workItemId: string,
  planningDatabaseUrl: string
): Promise<WorkItemContext> {
  const planningModule = await import("@taxes/plan-api");
  const workItem = await planningModule.getWorkItemById(workItemId, { databaseUrl: planningDatabaseUrl });
  if (!workItem) {
    return { title: workItemId, summary: "", acceptanceCriteria: [], tasks: [] };
  }
  return {
    title: workItem.title,
    summary: workItem.summary,
    acceptanceCriteria: Array.isArray(workItem.acceptanceCriteria)
      ? extractStrings(workItem.acceptanceCriteria as unknown[], "criterion")
      : [],
    tasks: Array.isArray(workItem.tasks)
      ? extractStrings(workItem.tasks as unknown[], "title")
      : []
  };
}

function runGit(args: string[]): string | null {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args);
  return result.status === 0 ? result.stdout.toString() : null;
}

function gatherGitContext(step: ContextPackStep): { diff: string; changedFiles: string[] } {
  if (!step.includeGitDiff) return { diff: "", changedFiles: [] };
  try {
    const nameOnly = runGit(["diff", "origin/main...HEAD", "--name-only"]);
    const changedFiles = nameOnly ? nameOnly.split("\n").filter((l) => l.trim()) : [];
    const stat = runGit(["diff", "origin/main...HEAD", "--stat"]);
    let diff = stat ?? "";
    if (diff.length > 5000) diff = `${diff.substring(0, 5000)}\n[... truncated ...]`;
    return { diff, changedFiles };
  } catch {
    return { diff: "", changedFiles: [] };
  }
}

function parsePreviousError(contextJson: string | null): string | undefined {
  if (contextJson === null) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ctx = JSON.parse(contextJson);
    const err = (ctx as Record<string, unknown>).error;
    if (typeof err === "string") return `Previous attempt failed with error: ${err}`;
    if (err !== null && typeof err === "object" && "message" in err) {
      const msg = (err as Record<string, unknown>).message;
      if (typeof msg === "string") return `Previous attempt failed with error: ${msg}`;
    }
  } catch { /* ignore parse failure */ }
  return undefined;
}

async function loadPreviousAttempt(
  db: PrismaClient,
  run: WorkflowRun,
  workItemId: string
): Promise<string | undefined> {
  try {
    const previousRun = await db.workflowRun.findFirst({
      where: {
        definitionName: run.definitionName,
        status: "failed",
        contextJson: { contains: JSON.stringify(workItemId) }
      },
      orderBy: { completedAt: "desc" }
    });
    return previousRun ? parsePreviousError(previousRun.contextJson) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads work item from planning database and gathers rich context including
 * git diff, changed files, and previous attempt history.
 */
export async function executeContextPackStep(input: ContextPackInput): Promise<ContextPackResult> {
  const { db, run, step, planningDatabaseUrl } = input;
  const workItemId = resolveWorkItemId(step, run);

  let workItemContext: WorkItemContext = { title: workItemId, summary: "", acceptanceCriteria: [], tasks: [] };
  if (planningDatabaseUrl) {
    try {
      workItemContext = await loadWorkItemDetails(workItemId, planningDatabaseUrl);
    } catch (error) {
      console.warn(`Failed to load work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const { diff: gitDiff, changedFiles } = gatherGitContext(step);

  const previousAttemptSummary = step.includePreviousAttempts
    ? await loadPreviousAttempt(db, run, workItemId)
    : undefined;

  return {
    workItemId,
    workItemTitle: workItemContext.title,
    workItemSummary: workItemContext.summary,
    acceptanceCriteria: workItemContext.acceptanceCriteria,
    tasks: workItemContext.tasks,
    gitDiff,
    changedFiles,
    ...(previousAttemptSummary !== undefined ? { previousAttemptSummary } : {}),
    packedAt: new Date().toISOString()
  };
}
