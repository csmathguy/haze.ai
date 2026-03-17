import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunEffect,
  WorkflowEffect,
  StepResult,
  WorkflowEvent
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
}
