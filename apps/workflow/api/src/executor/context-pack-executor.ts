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

/**
 * Loads work item from planning database and gathers rich context including
 * git diff, changed files, and previous attempt history.
 */
export async function executeContextPackStep(
  db: PrismaClient,
  runId: string,
  run: WorkflowRun,
  step: ContextPackStep,
  planningDatabaseUrl: string | undefined
): Promise<ContextPackResult> {
  // Resolve workItemId: from step config or from input context
  let workItemId = step.workItemId;
  if (!workItemId && run.contextJson) {
    const input = run.contextJson.input as Record<string, unknown> | undefined;
    workItemId = input?.workItemId as string | undefined;
  }

  if (!workItemId) {
    throw new Error(
      "Unable to determine workItemId: not provided in step config and not found in contextJson.input"
    );
  }

  // Fetch work item from planning database if available
  let workItemTitle = workItemId;
  let workItemSummary = "";
  const acceptanceCriteria: string[] = [];
  const tasks: string[] = [];

  if (planningDatabaseUrl) {
    try {
      const planningModule = await import("@taxes/plan-api");
      const workItem = await planningModule.getWorkItemById(workItemId, {
        databaseUrl: planningDatabaseUrl
      });

      if (workItem) {
        workItemTitle = workItem.title;
        workItemSummary = workItem.summary || "";
        // Extract acceptance criteria texts
        if (Array.isArray(workItem.acceptanceCriteria)) {
          for (const criterion of workItem.acceptanceCriteria) {
            if (criterion && typeof criterion === "object") {
              const text = (criterion as Record<string, unknown>).criterion;
              if (typeof text === "string") {
                acceptanceCriteria.push(text);
              }
            }
          }
        }
        // Extract task texts
        if (Array.isArray(workItem.tasks)) {
          for (const task of workItem.tasks) {
            if (task && typeof task === "object") {
              const text = (task as Record<string, unknown>).title;
              if (typeof text === "string") {
                tasks.push(text);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(
        `Failed to load work item ${workItemId} from planning database: ${error instanceof Error ? error.message : String(error)}`
      );
      // Continue with minimal context if planning DB fails
    }
  }

  // Gather git diff and changed files
  let gitDiff = "";
  const changedFiles: string[] = [];

  if (step.includeGitDiff) {
    try {
      // Try to get diff between main and HEAD
      const diffResult = spawnSync("git", [
        "diff",
        "origin/main...HEAD",
        "--name-only"
      ]);

      if (diffResult.status === 0) {
        const changedFilesList = diffResult.stdout
          .toString()
          .split("\n")
          .filter((line) => line.trim());
        changedFiles.push(...changedFilesList);
      }

      // Get stat summary (total changed files and insertions/deletions)
      const statResult = spawnSync("git", [
        "diff",
        "origin/main...HEAD",
        "--stat"
      ]);

      if (statResult.status === 0) {
        gitDiff = statResult.stdout.toString();
        // Truncate to first 5000 chars if necessary
        if (gitDiff.length > 5000) {
          gitDiff = gitDiff.substring(0, 5000) + "\n[... truncated ...]";
        }
      }
    } catch (error) {
      console.warn(
        `Failed to gather git diff: ${error instanceof Error ? error.message : String(error)}`
      );
      // Continue without git diff if git command fails
    }
  }

  // Gather previous attempt summary if available
  let previousAttemptSummary: string | undefined;

  if (step.includePreviousAttempts) {
    try {
      const previousRun = await db.workflowRun.findFirst({
        where: {
          definitionName: run.definitionName,
          status: "failed",
          contextJson: {
            contains: JSON.stringify(workItemId)
          }
        },
        orderBy: { completedAt: "desc" }
      });

      if (previousRun) {
        try {
          const previousContext = JSON.parse(previousRun.contextJson);
          const error = (previousContext as Record<string, unknown>).error;
          if (typeof error === "string") {
            previousAttemptSummary = `Previous attempt failed with error: ${error}`;
          } else if (
            error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as Record<string, unknown>).message === "string"
          ) {
            previousAttemptSummary = `Previous attempt failed with error: ${(error as Record<string, unknown>).message}`;
          }
        } catch {
          // Couldn't parse context, skip
        }
      }
    } catch (error) {
      console.warn(
        `Failed to load previous attempt: ${error instanceof Error ? error.message : String(error)}`
      );
      // Continue without previous attempt info
    }
  }

  return {
    workItemId,
    workItemTitle,
    workItemSummary,
    acceptanceCriteria,
    tasks,
    gitDiff,
    changedFiles,
    previousAttemptSummary,
    packedAt: new Date().toISOString()
  };
}
