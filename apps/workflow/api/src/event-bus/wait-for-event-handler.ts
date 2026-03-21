import type { PrismaClient } from "@taxes/db";
import { WorkflowEngine } from "@taxes/shared";

interface WaitingStepInputData {
  eventType: string;
  expectedAt?: string;
  correlationKey?: string;
  timeoutMs?: number;
}

function convertRunToSchema(run: {
  id: string;
  definitionName: string;
  version: string;
  status: string;
  currentStep: string | null;
  contextJson: string | null;
  correlationId: string | null;
  parentRunId: string | null;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}) {
  const contextJson: Record<string, unknown> = run.contextJson
    ? (JSON.parse(run.contextJson) as Record<string, unknown>)
    : {};

  return {
    id: run.id,
    definitionName: run.definitionName,
    version: run.version,
    status: run.status as "running" | "pending" | "paused" | "waiting" | "failed" | "completed" | "cancelled",
    currentStepId: run.currentStep ?? undefined,
    contextJson,
    correlationId: run.correlationId ?? undefined,
    parentRunId: run.parentRunId ?? undefined,
    startedAt: run.startedAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    completedAt: run.completedAt?.toISOString()
  };
}

/**
 * Scans all incomplete wait-for-event step runs and resumes any workflow runs
 * whose awaited event type matches the incoming event type.
 * Returns true if at least one run was matched and resumed.
 */
export async function checkForWaitForEventMatches(
  db: PrismaClient,
  eventType: string,
  payload: Record<string, unknown>,
  correlationId?: string | null
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const waitingStepRuns: { id: string; runId: string; inputJson: string | null; run: { status: string } }[] = await (db as any).workflowStepRun.findMany({
    where: { stepType: "wait-for-event", completedAt: null },
    include: { run: true }
  });

  const matches = waitingStepRuns.filter((stepRun) => {
    if (stepRun.run.status !== "waiting") return false;
    if (correlationId !== undefined && correlationId !== null && stepRun.runId !== correlationId) {
      return false;
    }
    const inputData = JSON.parse(stepRun.inputJson ?? "{}") as WaitingStepInputData;
    return inputData.eventType === eventType;
  });

  if (matches.length === 0) return false;

  for (const stepRun of matches) {
    const run = await db.workflowRun.findUnique({
      where: { id: stepRun.runId }
    });

    if (!run) {
      continue;
    }

    const engine = new WorkflowEngine();
    const workflowEvent = { type: eventType, payload };
    const signalResult = engine.signalRun(convertRunToSchema(run), workflowEvent);

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
      data: {
        status: signalResult.nextRun.status,
        currentStep: signalResult.nextRun.currentStepId ?? null,
        contextJson: JSON.stringify(signalResult.nextRun.contextJson),
        updatedAt: new Date(signalResult.nextRun.updatedAt),
        completedAt: signalResult.nextRun.completedAt ? new Date(signalResult.nextRun.completedAt) : null
      }
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
  const waitingStepRuns: { id: string; runId: string; inputJson: string | null; run: { status: string } }[] = await (db as any).workflowStepRun.findMany({
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
