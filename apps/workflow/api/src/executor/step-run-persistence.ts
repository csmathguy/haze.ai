import type { PrismaClient, WorkflowStepRun } from "@taxes/db";
import type { CommandStepResult } from "./command-executor.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export async function recordStepStart(
  db: PrismaClient,
  runId: string,
  stepId: string,
  stepType: string
): Promise<WorkflowStepRun> {
  return (db as AnyPrisma).workflowStepRun.create({
    data: {
      runId,
      stepId,
      stepType,
      nodeType: "deterministic",
      inputJson: "{}",
      retryCount: 0,
      startedAt: new Date()
    }
  }) as Promise<WorkflowStepRun>;
}

export async function recordStepComplete(
  db: PrismaClient,
  stepRunId: string,
  result: CommandStepResult
): Promise<WorkflowStepRun> {
  return (db as AnyPrisma).workflowStepRun.update({
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
  }) as Promise<WorkflowStepRun>;
}

export async function recordStepFailed(
  db: PrismaClient,
  stepRunId: string,
  error: string
): Promise<WorkflowStepRun> {
  return (db as AnyPrisma).workflowStepRun.update({
    where: { id: stepRunId },
    data: {
      errorJson: JSON.stringify({
        message: error,
        code: "EXECUTION_ERROR"
      }),
      completedAt: new Date()
    }
  }) as Promise<WorkflowStepRun>;
}
