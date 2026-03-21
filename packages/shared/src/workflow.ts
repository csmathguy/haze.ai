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
   */
  advanceRun(run: WorkflowRun, stepResult: StepResult): WorkflowRunEffect {
    const now = new Date().toISOString();
    const nextRun: WorkflowRun = {
      ...run,
      updatedAt: now
    };
    const effects: WorkflowEffect[] = [];

    // If the step failed, transition to failed state
    if (stepResult.type === "failure") {
      nextRun.status = "failed";
      nextRun.completedAt = now;
      const failureEffect: WorkflowEffect = {
        type: "fail-run",
        error: {
          message: stepResult.error.message,
          ...(stepResult.error.code !== undefined && { code: stepResult.error.code })
        }
      };
      effects.push(failureEffect);
      return { nextRun, effects };
    }

    // Update context with step output
    if (stepResult.output && run.currentStepId !== undefined) {
      const stepKey = `step_${run.currentStepId}`;
      nextRun.contextJson = {
        ...nextRun.contextJson,
        [stepKey]: stepResult.output
      };
    }

    // For now, with a linear execution model, mark as completed
    // (In a more complex state machine with branches, this would advance
    //  to the next step in the sequence)
    nextRun.status = "completed";
    nextRun.completedAt = now;
    effects.push({
      type: "complete-run",
      output: nextRun.contextJson
    });

    return { nextRun, effects };
  }

  /**
   * Signals a workflow run with an external event.
   * Used for wait-for-event and approval steps.
   */
  signalRun(run: WorkflowRun, event: WorkflowEvent): WorkflowRunEffect {
    const now = new Date().toISOString();
    const nextRun: WorkflowRun = {
      ...run,
      updatedAt: now
    };
    const effects: WorkflowEffect[] = [];

    // Update context with event
    nextRun.contextJson = {
      ...nextRun.contextJson,
      lastEvent: {
        type: event.type,
        payload: event.payload,
        receivedAt: now
      }
    };

    // Transition based on event type
    // On any event, transition to running state
    nextRun.status = "running";

    const eventType = `${event.type}-processed`;
    effects.push({
      type: "emit-event",
      eventType,
      payload: { runId: run.id }
    });

    return { nextRun, effects };
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
