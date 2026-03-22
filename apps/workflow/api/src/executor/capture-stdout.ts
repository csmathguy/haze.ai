import type { PrismaClient } from "@taxes/db";
import type { WorkflowRun } from "@taxes/shared";

/**
 * If the step declares captureStdoutKey, persists the trimmed last non-empty stdout line
 * to contextJson under that key and returns the updated run. Otherwise returns run unchanged.
 */
export async function applyCaptureStdoutKey(
  db: PrismaClient,
  run: WorkflowRun,
  captureKey: string | undefined,
  stdout: string
): Promise<WorkflowRun> {
  if (!captureKey) return run;
  const captured = stdout.trim().split("\n").filter(Boolean).at(-1)?.trim() ?? "";
  if (!captured) return run;
  const updatedContext = { ...run.contextJson, [captureKey]: captured };
  await db.workflowRun.update({ where: { id: run.id }, data: { contextJson: JSON.stringify(updatedContext) } });
  return { ...run, contextJson: updatedContext };
}
