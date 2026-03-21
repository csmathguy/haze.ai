import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunEffect,
  WorkflowEffect,
  StepResult,
  WorkflowEvent,
  ParallelStep
} from "./workflow-schemas.js";

/**
 * Pure state machine for workflow orchestration.
 * All methods are side-effect-free: they take state + input, return (nextState, effects[]).
 */
export class WorkflowEngine {
  /**
   * Starts a new workflow run from a definition and input.
   * Returns the initial run state and initial effects to execute.
   */
  startRun(
    definition: WorkflowDefinition,
    input: unknown
  ): WorkflowRunEffect {
    const runId = this.generateId();
    const now = new Date().toISOString();

    // Create initial run state
    const initialRun: WorkflowRun = {
      id: runId,
      definitionName: definition.name,
      version: definition.version,
      status: "running",
      currentStepId: definition.steps[0]?.id,
      contextJson: {
        input,
        metadata: {
          startedAt: now
        }
      },
      startedAt: now,
      updatedAt: now
    };

    // Generate first effect: execute the first step
    const effects: WorkflowEffect[] = [];
    const firstStep = definition.steps[0];
    if (firstStep !== undefined) {
      effects.push({
        type: "execute-step",
        step: firstStep
      });
    } else {
      // No steps—complete immediately
      initialRun.status = "completed";
      initialRun.completedAt = now;
      effects.push({
        type: "complete-run",
        output: {}
      });
    }

    return {
      nextRun: initialRun,
      effects
    };
  }

  /**
   * Advances a workflow run based on a step result.
   * Transitions the run to the next step or terminal state.
   * Requires the workflow definition to determine step sequencing.
   */
  advanceRun(
    run: WorkflowRun,
    stepResult: StepResult,
    definition: WorkflowDefinition
  ): WorkflowRunEffect {
    const now = new Date().toISOString();

    // Handle step failure with retry logic
    if (stepResult.type === "failure") {
      return this.handleStepFailure(run, stepResult, definition, now);
    }

    // Create next run state with updated timestamp
    const nextRun: WorkflowRun = {
      ...run,
      updatedAt: now
    };
    const effects: WorkflowEffect[] = [];

    // Update context with step output
    if (stepResult.output && run.currentStepId) {
      const stepKey = `step_${run.currentStepId}`;
      nextRun.contextJson = {
        ...nextRun.contextJson,
        [stepKey]: stepResult.output
      };
    }

    // Handle condition steps
    const currentStep = definition.steps.find((s) => s.id === run.currentStepId);
    if (currentStep?.type === "condition") {
      const conditionResult = this.handleConditionStep(nextRun, currentStep as never, stepResult);
      if (conditionResult) {
        return conditionResult;
      }
    }

    // Advance to next step in sequence
    return this.advanceToNextStep(nextRun, definition, effects, now);
  }

  private handleStepFailure(
    run: WorkflowRun,
    stepResult: StepResult,
    definition: WorkflowDefinition,
    now: string
  ): WorkflowRunEffect {
    const nextRun: WorkflowRun = {
      ...run,
      updatedAt: now
    };
    const effects: WorkflowEffect[] = [];

    const currentStep = definition.steps.find((s) => s.id === run.currentStepId);
    const retryPolicy = currentStep && "retryPolicy" in currentStep
      ? currentStep.retryPolicy
      : definition.retryPolicy;

    const retryCountKey = `retry_count_${run.currentStepId ?? "unknown"}`;
    const currentRetryCount = (nextRun.contextJson[retryCountKey] as number) ?? 0;

    if (retryPolicy && currentRetryCount < retryPolicy.maxRetries) {
      nextRun.contextJson = {
        ...nextRun.contextJson,
        [retryCountKey]: currentRetryCount + 1
      };

      if (currentStep) {
        effects.push({
          type: "execute-step",
          step: currentStep
        });
      }

      return { nextRun, effects };
    }

    nextRun.status = "failed";
    nextRun.completedAt = now;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorMessage = stepResult.error.message;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorCode = stepResult.error.code;
    effects.push({
      type: "fail-run",
      error: {
        message: errorMessage,
        ...(errorCode !== undefined && { code: errorCode })
      }
    });

    return { nextRun, effects };
  }

  private handleConditionStep(
    run: WorkflowRun,
    conditionStep: never,
    stepResult: StepResult
  ): WorkflowRunEffect | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const branchResult = stepResult.output?.branch as string | undefined;
    const currentStepId = run.currentStepId ?? "";

    const branchKey = branchResult === "true" ? "trueBranch" : "falseBranch";
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const branch = (conditionStep as Record<string, unknown>)[branchKey] as never[] | undefined;

    if (branch && branch.length > 0) {
      const firstBranchStep = branch[0] as never;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const stepId = (firstBranchStep as Record<string, unknown>).id as string;

      const nextRun: WorkflowRun = {
        ...run,
        currentStepId: stepId,
        contextJson: {
          ...run.contextJson,
          [`condition_${currentStepId}_branch`]: branchResult,
          [`__pendingSteps_${currentStepId}`]: branch
        }
      };

      return {
        nextRun,
        effects: [{
          type: "execute-step",
          step: firstBranchStep
        }]
      };
    }

    return undefined;
  }

  private advanceToNextStep(
    run: WorkflowRun,
    definition: WorkflowDefinition,
    _effects: WorkflowEffect[],
    now: string
  ): WorkflowRunEffect {
    const currentStepIndex = definition.steps.findIndex((s) => s.id === run.currentStepId);

    if (currentStepIndex === -1 || currentStepIndex + 1 >= definition.steps.length) {
      // No next step - complete the workflow
      return {
        nextRun: {
          ...run,
          status: "completed",
          completedAt: now
        },
        effects: [{
          type: "complete-run",
          output: run.contextJson
        }]
      };
    }

    const nextStep = definition.steps[currentStepIndex + 1];

    if (nextStep?.type === "approval") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const approvalPrompt = ((nextStep as Record<string, unknown>).prompt as string) ?? "Approval required";
      return {
        nextRun: {
          ...run,
          currentStepId: nextStep.id,
          status: "paused"
        },
        effects: [{
          type: "create-approval",
          stepId: nextStep.id,
          prompt: approvalPrompt
        }]
      };
    }

    if (nextStep?.type === "parallel") {
      return this.executeParallelStep(
        { ...run, currentStepId: nextStep.id },
        nextStep as ParallelStep
      );
    }

    // Normal step - advance to it
    return {
      nextRun: {
        ...run,
        currentStepId: nextStep.id
      },
      effects: [{
        type: "execute-step",
        step: nextStep
      }]
    };
  }

  /**
   * Signals a workflow run with an external event.
   * Used for wait-for-event and approval steps.
   * Optionally accepts the workflow definition for approval handling.
   */
  signalRun(
    run: WorkflowRun,
    event: WorkflowEvent,
    definition?: WorkflowDefinition
  ): WorkflowRunEffect {
    const now = new Date().toISOString();
    const nextRun: WorkflowRun = {
      ...run,
      updatedAt: now
    };

    // Update context with event
    nextRun.contextJson = {
      ...nextRun.contextJson,
      lastEvent: {
        type: event.type,
        payload: event.payload,
        receivedAt: now
      }
    };

    // Handle approval.responded event
    if (event.type === "approval.responded" && definition) {
      return this.handleApprovalResponse(nextRun, event, definition, now);
    }

    // Default behavior: emit processed event
    nextRun.status = "running";
    return {
      nextRun,
      effects: [{
        type: "emit-event",
        eventType: `${event.type}-processed`,
        payload: { runId: run.id }
      }]
    };
  }

  private handleApprovalResponse(
    run: WorkflowRun,
    event: WorkflowEvent,
    definition: WorkflowDefinition,
    now: string
  ): WorkflowRunEffect {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const decision = event.payload?.decision as string | undefined;

    if (decision === "rejected") {
      return {
        nextRun: {
          ...run,
          status: "failed",
          completedAt: now
        },
        effects: [{
          type: "fail-run",
          error: {
            message: "Approval rejected",
            code: "APPROVAL_REJECTED"
          }
        }]
      };
    }

    if (decision === "approved") {
      return this.advanceAfterApproval(run, definition, now);
    }

    // Fallback for unknown decision
    return {
      nextRun: run,
      effects: []
    };
  }

  private advanceAfterApproval(
    run: WorkflowRun,
    definition: WorkflowDefinition,
    now: string
  ): WorkflowRunEffect {
    const currentStepIndex = definition.steps.findIndex((s) => s.id === run.currentStepId);

    if (currentStepIndex === -1 || currentStepIndex + 1 >= definition.steps.length) {
      // No more steps - complete workflow
      return {
        nextRun: {
          ...run,
          status: "completed",
          completedAt: now
        },
        effects: [{
          type: "complete-run",
          output: run.contextJson
        }]
      };
    }

    const nextStep = definition.steps[currentStepIndex + 1];

    if (nextStep?.type === "approval") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const approvalPrompt = ((nextStep as Record<string, unknown>).prompt as string) ?? "Approval required";
      return {
        nextRun: {
          ...run,
          currentStepId: nextStep.id,
          status: "paused"
        },
        effects: [{
          type: "create-approval",
          stepId: nextStep.id,
          prompt: approvalPrompt
        }]
      };
    }

    if (nextStep?.type === "parallel") {
      return this.executeParallelStep(
        { ...run, currentStepId: nextStep.id },
        nextStep as ParallelStep
      );
    }

    // Normal step - guaranteed to exist at this point
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return {
      nextRun: {
        ...run,
        currentStepId: nextStep.id,
        status: "running"
      },
      effects: [{
        type: "execute-step",
        step: nextStep as never
      }]
    };
  }

  /**
   * Cancels a workflow run.
   * Transitions the run to cancelled state.
   */
  cancelRun(run: WorkflowRun): WorkflowRunEffect {
    const now = new Date().toISOString();
    const nextRun: WorkflowRun = {
      ...run,
      status: "cancelled",
      updatedAt: now,
      completedAt: now
    };

    const effects: WorkflowEffect[] = [
      {
        type: "fail-run",
        error: {
          message: "Workflow cancelled",
          code: "CANCELLED"
        }
      }
    ];

    return { nextRun, effects };
  }

  /**
   * Executes a parallel step by forking all branches.
   * Returns effects to execute the first step of each branch concurrently.
   * The parallel step remains in "running" state until all branches complete.
   */
  executeParallelStep(run: WorkflowRun, parallelStep: ParallelStep): WorkflowRunEffect {
    const now = new Date().toISOString();
    const nextRun: WorkflowRun = {
      ...run,
      updatedAt: now
    };
    const effects: WorkflowEffect[] = [];

    // Handle edge case: no branches
    if (parallelStep.branches.length === 0) {
      nextRun.status = "completed";
      nextRun.completedAt = now;
      effects.push({
        type: "complete-run",
        output: nextRun.contextJson
      });
      return { nextRun, effects };
    }

    // Initialize branch tracking in context
    const branchStates: Record<string, { status: "running" | "success" | "failure"; error?: { message: string; code?: string } }> = {};
    parallelStep.branches.forEach((_branch, i) => {
      branchStates[`branch_${String(i)}`] = { status: "running" };
    });

    nextRun.contextJson = {
      ...nextRun.contextJson,
      [this.getParallelStepKey(parallelStep.id)]: {
        totalBranches: parallelStep.branches.length,
        completedBranches: 0,
        failedBranch: null,
        branchStates
      }
    };

    // Generate execute-step effects for the first step of each branch
    for (const branch of parallelStep.branches) {
      const firstStepInBranch = branch[0];
      if (firstStepInBranch !== undefined) {
        effects.push({
          type: "execute-step",
          step: firstStepInBranch
        });
      }
    }

    return { nextRun, effects };
  }

  /**
   * Handles the completion of a branch within a parallel step.
   * Updates branch status and checks if all branches are complete.
   */
  completeBranchInParallelStep(
    run: WorkflowRun,
    parallelStepId: string,
    branchIndex: number,
    result: StepResult
  ): WorkflowRunEffect {
    const now = new Date().toISOString();
    const nextRun: WorkflowRun = {
      ...run,
      updatedAt: now
    };
    const effects: WorkflowEffect[] = [];

    const parallelStepKey = this.getParallelStepKey(parallelStepId);
    const rawParallelState: unknown = nextRun.contextJson[parallelStepKey];

    if (rawParallelState === undefined || rawParallelState === null) {
      // Parallel step not found in context - this shouldn't happen
      nextRun.status = "failed";
      nextRun.completedAt = now;
      effects.push({
        type: "fail-run",
        error: {
          message: "Parallel step context not found",
          code: "INVALID_STATE"
        }
      });
      return { nextRun, effects };
    }

    const parallelState = rawParallelState as Record<string, unknown>;
    const branchStates = parallelState.branchStates as Record<string, Record<string, unknown>>;
    const branchKey = `branch_${String(branchIndex)}`;
    const totalBranches = parallelState.totalBranches as number;

    if (result.type === "failure") {
      // Mark this branch as failed
      branchStates[branchKey] = {
        status: "failure",
        error: result.error
      };

      // Entire parallel step fails on first branch failure
      nextRun.status = "failed";
      nextRun.completedAt = now;

      parallelState.failedBranch = {
        index: branchIndex,
        error: result.error
      };

      effects.push({
        type: "fail-run",
        error: {
          message: `Branch ${String(branchIndex)} failed: ${result.error.message}`,
          code: result.error.code ?? "BRANCH_FAILED"
        }
      });

      return { nextRun, effects };
    }

    // Mark branch as success and update completed count
    branchStates[branchKey] = {
      status: "success"
    };

    const completedBranches = (parallelState.completedBranches as number) + 1;
    parallelState.completedBranches = completedBranches;

    // Store branch output
    if (result.output) {
      nextRun.contextJson = {
        ...nextRun.contextJson,
        [this.getBranchOutputKey(parallelStepId, branchIndex)]: result.output
      };
    }

    // Check if all branches are complete
    if (completedBranches === totalBranches) {
      // All branches succeeded - complete the parallel step
      nextRun.status = "completed";
      nextRun.completedAt = now;
      effects.push({
        type: "complete-run",
        output: nextRun.contextJson
      });
    }
    // If not all branches are complete, stay in running state (no effect)

    return { nextRun, effects };
  }

  /**
   * Generate a deterministic ID for a workflow run.
   * In production, this would use UUID or similar.
   * @note - Using Math.random() for non-cryptographic ID generation is safe here
   */
  private generateId(): string {
    const timestamp = Date.now().toString();
    // sonarjs/pseudo-random: This is non-critical ID generation, not security-sensitive
    // eslint-disable-next-line sonarjs/pseudo-random
    const randomStr = Math.random().toString(36).substring(2, 11);
    return `run_${timestamp}_${randomStr}`;
  }

  /**
   * Get the key for storing parallel step state in context.
   */
  private getParallelStepKey(stepId: string): string {
    return `parallel_${stepId}`;
  }

  /**
   * Get the key for storing branch output in context.
   */
  private getBranchOutputKey(parallelStepId: string, branchIndex: number): string {
    return `branch_${parallelStepId}_${String(branchIndex)}_output`;
  }
}
