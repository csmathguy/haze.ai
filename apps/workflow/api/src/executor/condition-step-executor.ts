import type { ConditionStep, WorkflowRun } from "@taxes/shared";

/**
 * Result from evaluating a condition step.
 * Indicates which branch was selected.
 */
export interface ConditionStepResult {
  readonly stepId: string;
  readonly selectedBranch: "true" | "false";
  readonly conditionValue: boolean;
  readonly durationMs: number;
}

/**
 * Executes condition steps by evaluating the condition expression against the run context.
 *
 * The executor:
 * - Evaluates the condition function with the current run context
 * - Selects the matching branch (trueBranch or falseBranch)
 * - Records which branch was selected
 *
 * Branch routing is handled by the workflow engine, not the executor.
 */
export class ConditionStepExecutor {
  /**
   * Executes a condition step.
   *
   * @param run - Current workflow run state with context
   * @param step - Condition step definition
   * @returns Result indicating which branch was selected
   * @throws Error if condition evaluation fails
   */
  execute(run: WorkflowRun, step: ConditionStep): ConditionStepResult {
    const startTime = Date.now();

    try {
      // Evaluate the condition against the current context
      const conditionValue = step.condition(run.contextJson);

      const durationMs = Date.now() - startTime;

      return {
        stepId: step.id,
        selectedBranch: conditionValue ? "true" : "false",
        conditionValue,
        durationMs
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to evaluate condition step ${step.id}: ${message}`,
        { cause: error }
      );
    }
  }
}
