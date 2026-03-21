import type { PrismaClient } from "@taxes/db";

interface WaitingStepInputData {
  eventType: string;
  expectedAt?: string;
  correlationKey?: string;
  timeoutMs?: number;
}

/**
 * Scans all incomplete wait-for-event step runs and resumes any workflow runs
 * whose awaited event type matches the incoming event type.
 * Returns true if at least one run was matched and resumed.
 */
export async function checkForWaitForEventMatches(
  db: PrismaClient,
  eventType: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const waitingStepRuns: Array<{ id: string; runId: string; inputJson: string | null; run: { status: string } }> = await (db as any).workflowStepRun.findMany({
    where: { stepType: "wait-for-event", completedAt: null },
    include: { run: true }
  });

  const matches = waitingStepRuns.filter((stepRun) => {
    if (stepRun.run.status !== "waiting") return false;
    const inputData = JSON.parse(stepRun.inputJson ?? "{}") as WaitingStepInputData;
    return inputData.eventType === eventType;
  });

  if (matches.length === 0) return false;

  for (const stepRun of matches) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (db as any).workflowStepRun.update({
      where: { id: stepRun.id },
      data: {
        outputJson: JSON.stringify({ eventType, payload }),
        completedAt: new Date()
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (db as any).workflowRun.update({
      where: { id: stepRun.runId },
      data: { status: "running", updatedAt: new Date() }
    });
  }

  return true;
}

/**
 * Scans all incomplete wait-for-event step runs and fails any whose timeout has expired.
 */
export async function checkForTimedOutWaitingSteps(db: PrismaClient): Promise<void> {
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const waitingStepRuns: Array<{ id: string; runId: string; inputJson: string | null; run: { status: string } }> = await (db as any).workflowStepRun.findMany({
    where: { stepType: "wait-for-event", completedAt: null },
    include: { run: true }
  });

  for (const stepRun of waitingStepRuns) {
    if (stepRun.run.status !== "waiting") continue;

    const inputData = JSON.parse(stepRun.inputJson ?? "{}") as WaitingStepInputData;
    const { expectedAt } = inputData;

    if (expectedAt === undefined || expectedAt > now) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (db as any).workflowStepRun.update({
      where: { id: stepRun.id },
      data: {
        errorJson: JSON.stringify({ code: "TIMEOUT", message: "Timeout: wait-for-event step timed out" }),
        completedAt: new Date()
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (db as any).workflowRun.update({
      where: { id: stepRun.runId },
      data: { status: "failed", updatedAt: new Date(), completedAt: new Date() }
    });
  }
}
