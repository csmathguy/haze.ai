/**
 * Pure helper functions for workflow step sequencing.
 * Extracted from WorkflowEngine to keep workflow.ts under the 400-line limit.
 * All functions are side-effect-free.
 */

import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunEffect,
  WorkflowEffect,
  StepResult,
  WorkflowEvent,
  ParallelStep
} from "./workflow-schemas.js";

export type ExecuteParallelFn = (run: WorkflowRun, step: ParallelStep) => WorkflowRunEffect;

// -- handleStepFailure helpers (split to stay under complexity limit) ----------

function buildRetryEffect(
  nextRun: WorkflowRun,
  retryCountKey: string,
  currentRetryCount: number,
  currentStep: WorkflowDefinition["steps"][number] | undefined
): WorkflowRunEffect {
  const updatedRun = {
    ...nextRun,
    contextJson: { ...nextRun.contextJson, [retryCountKey]: currentRetryCount + 1 }
  };
  const effects: WorkflowEffect[] = [];
  if (currentStep) {
    effects.push({ type: "execute-step", step: currentStep });
  }
  return { nextRun: updatedRun, effects };
}

function buildFailEffect(
  nextRun: WorkflowRun,
  now: string,
  stepResult: StepResult
): WorkflowRunEffect {
  const failureResult = stepResult.type === "failure" ? stepResult : null;
  const errorMessage = failureResult?.error.message ?? "Step failed";
  const errorCode = failureResult?.error.code;
  return {
    nextRun: { ...nextRun, status: "failed", completedAt: now },
    effects: [{
      type: "fail-run",
      error: { message: errorMessage, ...(errorCode !== undefined && { code: errorCode }) }
    }]
  };
}

/** Handles step failure with retry logic. */
export function handleStepFailure(
  run: WorkflowRun,
  stepResult: StepResult,
  definition: WorkflowDefinition,
  now: string
): WorkflowRunEffect {
  const nextRun: WorkflowRun = { ...run, updatedAt: now };
  const currentStep = definition.steps.find((s) => s.id === run.currentStepId);
  const retryPolicy = currentStep && "retryPolicy" in currentStep
    ? currentStep.retryPolicy
    : definition.retryPolicy;

  const retryCountKey = `retry_count_${run.currentStepId ?? "unknown"}`;
  const rawCount: unknown = nextRun.contextJson[retryCountKey];
  const currentRetryCount = typeof rawCount === "number" ? rawCount : 0;

  if (retryPolicy && currentRetryCount < retryPolicy.maxRetries) {
    return buildRetryEffect(nextRun, retryCountKey, currentRetryCount, currentStep);
  }

  return buildFailEffect(nextRun, now, stepResult);
}

// -- handleConditionStep ------------------------------------------------------

/**
 * Handles ConditionStep branching — returns the effect to run the first branch step,
 * or undefined if no branch could be resolved.
 */
export function handleConditionStep(
  run: WorkflowRun,
  conditionStep: Record<string, unknown>,
  stepResult: StepResult
): WorkflowRunEffect | undefined {
  const successOutput = stepResult.type === "success" ? stepResult.output : undefined;
  const branchResult = successOutput?.branch as string | undefined;
  const currentStepId = run.currentStepId ?? "";

  const branchKey = branchResult === "true" ? "trueBranch" : "falseBranch";
  const branch = conditionStep[branchKey] as Record<string, unknown>[] | undefined;

  if (branch === undefined || branch.length === 0) return undefined;
  const firstBranchStep = branch[0];
  if (firstBranchStep === undefined) return undefined;

  const stepId = firstBranchStep.id as string;
  const nextRun: WorkflowRun = {
    ...run,
    currentStepId: stepId,
    contextJson: {
      ...run.contextJson,
      [`condition_${currentStepId}_branch`]: branchResult,
      [`__pendingSteps_${currentStepId}`]: branch
    }
  };
  // firstBranchStep is a WorkflowStep at runtime; typed as Record here due to JSON round-trip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const step: any = firstBranchStep;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  return { nextRun, effects: [{ type: "execute-step", step }] };
}

// -- advanceToNextLinearStep --------------------------------------------------

function buildApprovalPauseEffect(
  run: WorkflowRun,
  nextStep: { id: string; type: string; [key: string]: unknown }
): WorkflowRunEffect {
  const approvalPrompt = nextStep.prompt as string | undefined;
  return {
    nextRun: { ...run, currentStepId: nextStep.id, status: "paused" },
    effects: [{
      type: "create-approval",
      stepId: nextStep.id,
      prompt: approvalPrompt ?? "Approval required"
    }]
  };
}

/**
 * Advances the run to the next step in the linear definition sequence.
 * Handles ApprovalStep (pauses) and ParallelStep (delegates to executor).
 */
export function advanceToNextLinearStep(
  run: WorkflowRun,
  definition: WorkflowDefinition,
  now: string,
  executeParallel: ExecuteParallelFn
): WorkflowRunEffect {
  const currentStepIndex = definition.steps.findIndex((s) => s.id === run.currentStepId);
  const completeRun: WorkflowRunEffect = {
    nextRun: { ...run, status: "completed", completedAt: now },
    effects: [{ type: "complete-run", output: run.contextJson }]
  };

  if (currentStepIndex === -1 || currentStepIndex + 1 >= definition.steps.length) {
    return completeRun;
  }

  const nextStep = definition.steps[currentStepIndex + 1];
  if (nextStep === undefined) return completeRun;

  if (nextStep.type === "approval") {
    return buildApprovalPauseEffect(run, nextStep as { id: string; type: string; [key: string]: unknown });
  }

  if (nextStep.type === "parallel") {
    // nextStep.type === "parallel" is confirmed above; cast is safe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return executeParallel({ ...run, currentStepId: nextStep.id }, nextStep as any as ParallelStep);
  }

  return {
    nextRun: { ...run, currentStepId: nextStep.id, status: "running" },
    effects: [{ type: "execute-step", step: nextStep }]
  };
}

// -- handleApprovalResponse ---------------------------------------------------

/** Options passed to handleApprovalResponse to avoid exceeding the 4-param limit. */
export interface ApprovalResponseOptions {
  run: WorkflowRun;
  event: WorkflowEvent;
  definition: WorkflowDefinition;
  now: string;
  executeParallel: ExecuteParallelFn;
}

/**
 * Handles an approval.responded event and advances the run.
 */
export function handleApprovalResponse(opts: ApprovalResponseOptions): WorkflowRunEffect {
  const { run, event, definition, now, executeParallel } = opts;
  const decision = event.payload?.decision as string | undefined;

  if (decision === "rejected") {
    return {
      nextRun: { ...run, status: "failed", completedAt: now },
      effects: [{ type: "fail-run", error: { message: "Approval rejected", code: "APPROVAL_REJECTED" } }]
    };
  }

  if (decision === "approved") {
    return advanceToNextLinearStep(run, definition, now, executeParallel);
  }

  return { nextRun: run, effects: [] };
}
