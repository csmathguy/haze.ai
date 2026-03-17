import type { PrismaClient, WorkflowStepRun } from "@taxes/db";
import type { CommandStepResult } from "./command-executor.js";

export async function recordStepStart(
  db: PrismaClient,
  runId: string,
  stepId: string,
  stepType: string
): Promise<WorkflowStepRun> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const stepRun: WorkflowStepRun = await (db as unknown as Record<string, unknown>).workflowStepRun.create({
    data: {
      runId,
      stepId,
      stepType,
      nodeType: "deterministic",
      inputJson: "{}",
      retryCount: 0,
      startedAt: new Date()
    }
  });

  return stepRun;
}

export async function recordStepComplete(
  db: PrismaClient,
  stepRunId: string,
  result: CommandStepResult
): Promise<WorkflowStepRun> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const stepRun: WorkflowStepRun = await (db as unknown as Record<string, unknown>).workflowStepRun.update({
    where: { id: stepRunId },
    data: {
      outputJson: JSON.stringify({
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        success: result.success
      }),
      completedAt: new Date()
    }
  });

  return stepRun;
}

export async function recordStepFailed(
  db: PrismaClient,
  stepRunId: string,
  error: string
): Promise<WorkflowStepRun> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const stepRun: WorkflowStepRun = await (db as unknown as Record<string, unknown>).workflowStepRun.update({
    where: { id: stepRunId },
    data: {
      errorJson: JSON.stringify({
        message: error,
        code: "EXECUTION_ERROR"
      }),
      completedAt: new Date()
    }
  });

  return stepRun;
}
