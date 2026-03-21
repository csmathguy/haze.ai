import type { PrismaClient } from "@taxes/db";

export interface WaitForEventStepConfig {
  type: "wait-for-event";
  id: string;
  label?: string;
  eventType: string;
  correlationKey?: string;
  timeoutMs?: number;
}

export interface WaitForEventResult {
  type: "waiting";
  eventType: string;
  correlationKey?: string;
  timeoutMs?: number;
  startedAt: string;
}

export async function executeWaitForEventStep(
  db: PrismaClient,
  stepRunId: string,
  step: WaitForEventStepConfig
): Promise<WaitForEventResult> {
  const startedAt = new Date().toISOString();
  const expectedAt =
    step.timeoutMs !== undefined
      ? new Date(Date.now() + step.timeoutMs).toISOString()
      : undefined;

  const inputData: Record<string, unknown> = {
    eventType: step.eventType,
    startedAt,
    ...(step.correlationKey !== undefined && { correlationKey: step.correlationKey }),
    ...(step.timeoutMs !== undefined && { timeoutMs: step.timeoutMs }),
    ...(expectedAt !== undefined && { expectedAt })
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await (db as any).workflowStepRun.update({
    where: { id: stepRunId },
    data: { inputJson: JSON.stringify(inputData) }
  });

  return {
    type: "waiting",
    eventType: step.eventType,
    startedAt,
    ...(step.correlationKey !== undefined && { correlationKey: step.correlationKey }),
    ...(step.timeoutMs !== undefined && { timeoutMs: step.timeoutMs })
  };
}
