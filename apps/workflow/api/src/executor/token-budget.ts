import type { PrismaClient } from "@taxes/db";

/**
 * Sums all token usage recorded for a workflow run across all step runs.
 */
export async function sumRunTokens(db: PrismaClient, runId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  const stepRuns: { tokenUsageJson: string | null }[] = await (db as any).workflowStepRun.findMany({
    where: { runId },
    select: { tokenUsageJson: true }
  });
  return stepRuns.reduce((sum, sr) => {
    if (!sr.tokenUsageJson) return sum;
    try {
      const usage = JSON.parse(sr.tokenUsageJson) as { totalTokens?: number };
      return sum + (usage.totalTokens ?? 0);
    } catch {
      return sum;
    }
  }, 0);
}

/**
 * Returns true if the cumulative token usage for a run exceeds the given budget.
 */
export async function isTokenBudgetExceeded(db: PrismaClient, runId: string, budget: number): Promise<boolean> {
  const total = await sumRunTokens(db, runId);
  return total > budget;
}
