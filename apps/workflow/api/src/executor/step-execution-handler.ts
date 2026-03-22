/**
 * StepExecutionHandler: dispatches execute-step effects to the appropriate executor,
 * records results in the DB, and feeds outcomes back to the WorkflowEngine via advanceRun.
 *
 * This is the glue between the pure WorkflowEngine state machine and the
 * side-effectful CommandExecutor / AgentStepExecutor / ConditionStepExecutor.
 */

import type { PrismaClient } from "@taxes/db";
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunEffect,
  StepResult
} from "@taxes/shared";
import { WorkflowEngine } from "@taxes/shared";

import { executeCommandStep } from "./command-executor.js";
import { AgentStepExecutor, type StepExecutionEffect } from "./agent-step-executor.js";
import { ConditionStepExecutor } from "./condition-step-executor.js";
import { recordStepStart, recordStepComplete, recordStepFailed } from "./step-run-persistence.js";
import { executeWaitForEventStep } from "./wait-for-event-executor.js";
import { executeChildWorkflowStep } from "./child-workflow-executor.js";
import { executeContextPackStep } from "./context-pack-executor.js";
import { EventBus } from "../event-bus/event-bus.js";
import * as approvalService from "../services/approval-service.js";

/** A step from the execute-step effect — typed loosely since it may come from JSON. */
interface StepLike { type: string; id: string; [key: string]: unknown }

/**
 * Interpolates {{input.workItemId}} style context variables into a string value.
 * Supports dot-notation paths within contextJson.
 */
export function interpolateContextVar(template: string, contextJson: Record<string, unknown>): string {
  // eslint-disable-next-line sonarjs/slow-regex
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const parts = path.trim().split(".");
    let current: unknown = contextJson;
    for (const part of parts) {
      if (current !== null && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return _match; // leave unresolved placeholders as-is
      }
    }
    if (typeof current === "string") return current;
    if (current === null || current === undefined) return "";
    if (typeof current === "object") return JSON.stringify(current);
    // current is number | boolean | bigint | symbol at this point
    return (current as number | boolean | bigint).toString();
  });
}

/** Interpolates all string args in a command step's args array. */
function interpolateArgs(args: string[] | undefined, contextJson: Record<string, unknown>): string[] {
  return (args ?? []).map((arg) => interpolateContextVar(arg, contextJson));
}

/**
 * Executes a single step and returns a StepResult for the engine.
 * Also records start/complete/failed in the workflowStepRun table.
 */
export class StepExecutionHandler {
  private readonly db: PrismaClient;
  private readonly engine: WorkflowEngine;
  private readonly agentExecutor: AgentStepExecutor;
  private readonly conditionExecutor: ConditionStepExecutor;
  private readonly eventBus: EventBus;
  private readonly planningDatabaseUrl: string | undefined;

  constructor(db: PrismaClient, planningDatabaseUrl?: string) {
    this.db = db;
    this.engine = new WorkflowEngine();
    this.agentExecutor = new AgentStepExecutor();
    this.conditionExecutor = new ConditionStepExecutor();
    this.eventBus = new EventBus(db);
    this.planningDatabaseUrl = planningDatabaseUrl;
  }

  /**
   * Executes a step, persists result, calls engine.advanceRun, persists run state.
   * Returns the engine result so the worker can apply further effects.
   */
  async executeAndAdvance(
    runId: string,
    run: WorkflowRun,
    step: StepLike,
    definition: WorkflowDefinition
  ): Promise<WorkflowRunEffect> {
    const stepType = step.type;

    if (stepType === "command") {
      return this.executeCommandAndAdvance(runId, run, step, definition);
    }

    if (stepType === "condition") {
      return this.executeConditionAndAdvance(runId, run, step, definition);
    }

    if (stepType === "agent") {
      return this.executeAgentAndAdvance(runId, run, step, definition);
    }

    if (stepType === "approval") {
      return this.handleApprovalStep(runId, run, step);
    }

    if (stepType === "wait-for-event") {
      return this.executeWaitForEventAndAdvance(runId, run, step);
    }

    if (stepType === "child-workflow") {
      return this.executeChildWorkflowAndAdvance(runId, run, step, definition);
    }

    if (stepType === "context-pack") {
      return this.executeContextPackAndAdvance(runId, run, step, definition);
    }

    // Parallel steps are handled by the engine directly via executeParallelStep
    // and their branches will come as separate execute-step effects
    // Unknown types: fail the run
    const failResult: StepResult = {
      type: "failure",
      error: { message: `Unknown step type: ${stepType}`, code: "UNKNOWN_STEP_TYPE" }
    };
    return this.engine.advanceRun(run, failResult, definition);
  }

  // ---------------------------------------------------------------------------
  // CommandStep
  // ---------------------------------------------------------------------------

  private async executeCommandAndAdvance(
    runId: string,
    run: WorkflowRun,
    step: StepLike,
    definition: WorkflowDefinition
  ): Promise<WorkflowRunEffect> {
    const stepRun = await recordStepStart(this.db, runId, step.id, "command");
    let stepResult: StepResult;

    try {
      const args = interpolateArgs(step.args as string[] | undefined, run.contextJson);
      const timeoutMs = step.timeoutMs as number | undefined;
      const commandResult = await executeCommandStep({
        stepId: step.id,
        command: step.scriptPath as string,
        args,
        ...(timeoutMs !== undefined && { timeoutMs })
      });

      await recordStepComplete(this.db, stepRun.id, commandResult);

      if (commandResult.success) {
        stepResult = {
          type: "success",
          output: {
            exitCode: commandResult.exitCode,
            stdout: commandResult.stdout,
            stderr: commandResult.stderr,
            durationMs: commandResult.durationMs
          }
        };
      } else {
        stepResult = {
          type: "failure",
          error: {
            message: `Command exited with code ${String(commandResult.exitCode)}: ${commandResult.stderr.slice(0, 200)}`,
            code: "COMMAND_FAILED"
          }
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordStepFailed(this.db, stepRun.id, message);
      stepResult = { type: "failure", error: { message, code: "EXECUTION_ERROR" } };
    }

    return this.engine.advanceRun(run, stepResult, definition);
  }

  // ---------------------------------------------------------------------------
  // ConditionStep
  // ---------------------------------------------------------------------------

  private async executeConditionAndAdvance(
    runId: string,
    run: WorkflowRun,
    step: StepLike,
    definition: WorkflowDefinition
  ): Promise<WorkflowRunEffect> {
    const stepRun = await recordStepStart(this.db, runId, step.id, "condition");
    let stepResult: StepResult;

    try {
      // condition function may not be present if definition was deserialized from JSON
      const conditionFn = step.condition as ((ctx: Record<string, unknown>) => boolean) | undefined;
      if (typeof conditionFn !== "function") {
        // Condition can't be evaluated — default to true branch
        await recordStepFailed(this.db, stepRun.id, "Condition function not available (serialized definition)");
        stepResult = { type: "success", output: { branch: "true" } };
      } else {
        const conditionResult = this.conditionExecutor.execute(run, {
          type: "condition",
          id: step.id,
          label: (step.label as string | undefined) ?? step.id,
          condition: conditionFn,
          trueBranch: (step.trueBranch as never[] | undefined) ?? [],
          falseBranch: (step.falseBranch as never[] | undefined) ?? []
        });
        await recordStepComplete(this.db, stepRun.id, {
          stepId: step.id,
          exitCode: 0,
          stdout: `branch=${conditionResult.selectedBranch}`,
          stderr: "",
          durationMs: conditionResult.durationMs,
          success: true
        });
        stepResult = { type: "success", output: { branch: conditionResult.selectedBranch } };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordStepFailed(this.db, stepRun.id, message);
      stepResult = { type: "failure", error: { message, code: "CONDITION_ERROR" } };
    }

    return this.engine.advanceRun(run, stepResult, definition);
  }

  // ---------------------------------------------------------------------------
  // AgentStep
  // ---------------------------------------------------------------------------

  private async executeAgentAndAdvance(
    runId: string,
    run: WorkflowRun,
    step: StepLike,
    definition: WorkflowDefinition
  ): Promise<WorkflowRunEffect> {
    const stepRun = await recordStepStart(this.db, runId, step.id, "agent");
    let stepResult: StepResult;

    try {
      const providerFamily = step.providerFamily as "anthropic" | "openai" | undefined;
      const runtimeKind = step.runtimeKind as "claude-code-subagent" | "codex-subagent" | "api" | undefined;
      const agentStep = {
        type: "agent" as const,
        id: step.id,
        label: (step.label as string | undefined) ?? step.id,
        agentId: step.agentId as string,
        model: (step.model as string | undefined) ?? "claude-sonnet-4-6",
        ...(providerFamily !== undefined && { providerFamily }),
        ...(runtimeKind !== undefined && { runtimeKind }),
        skillIds: (step.skillIds as string[] | undefined) ?? [],
        outputSchema: step.outputSchema as never
      };

      const effect = await this.agentExecutor.execute(this.db, run, agentStep);
      stepResult = this.parseAgentEffectResult(effect);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordStepFailed(this.db, stepRun.id, message);
      stepResult = { type: "failure", error: { message, code: "EXECUTION_ERROR" } };
    }

    return this.engine.advanceRun(run, stepResult, definition);
  }

  private parseAgentEffectResult(effect: StepExecutionEffect): StepResult {
    if (effect.type === "step-completed") {
      const outputJson: string | null = effect.stepRun.outputJson;
      const output = outputJson ? JSON.parse(outputJson) as Record<string, unknown> : {};
      return { type: "success", output };
    }
    const errorJson: string | null = effect.stepRun.errorJson;
    const errorData = errorJson ? JSON.parse(errorJson) as { message?: string } : {};
    return {
      type: "failure",
      error: { message: errorData.message ?? "Agent step failed", code: "AGENT_FAILED" }
    };
  }

  // ---------------------------------------------------------------------------
  // ApprovalStep — pause the run, create approval record, wait for signal
  // ---------------------------------------------------------------------------

  private async handleApprovalStep(
    runId: string,
    run: WorkflowRun,
    step: StepLike
  ): Promise<WorkflowRunEffect> {
    // The engine already emitted create-approval and set status to "paused".
    // This handler just ensures the approval record exists (idempotent).
    const existing = await this.db.workflowApproval.findFirst({
      where: { runId, stepId: step.id, status: "pending" }
    });

    if (!existing) {
      await approvalService.createApproval(this.db, {
        runId,
        stepId: step.id,
        prompt: (step.prompt as string | undefined) ?? "Approval required"
      });
    }

    // Emit event to signal the run is waiting
    await this.eventBus.emit({
      workflowRunId: runId,
      eventType: "step.waiting-for-approval",
      payload: { stepId: step.id }
    });

    // Return the current run state unchanged (paused)
    return {
      nextRun: { ...run, status: "paused" },
      effects: []
    };
  }

  // ---------------------------------------------------------------------------
  // WaitForEventStep — pause the run until a matching external event arrives
  // ---------------------------------------------------------------------------

  private async executeWaitForEventAndAdvance(
    runId: string,
    run: WorkflowRun,
    step: StepLike
  ): Promise<WorkflowRunEffect> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const existing: { id: string } | null = await (this.db as any).workflowStepRun.findFirst({
      where: { runId, stepId: step.id }
    });

    let stepRunId: string;
    if (existing) {
      stepRunId = existing.id;
    } else {
      const created = await recordStepStart(this.db, runId, step.id, "wait-for-event");
      stepRunId = created.id;
    }

    await executeWaitForEventStep(this.db, stepRunId, {
      type: "wait-for-event",
      id: step.id,
      ...(step.label !== undefined ? { label: step.label as string } : {}),
      eventType: step.eventType as string,
      ...(step.correlationKey !== undefined ? { correlationKey: step.correlationKey as string } : {}),
      ...(step.timeoutMs !== undefined ? { timeoutMs: step.timeoutMs as number } : {})
    });

    await this.eventBus.emit({
      workflowRunId: runId,
      eventType: "step.waiting-for-event",
      payload: { stepId: step.id }
    });

    return {
      nextRun: { ...run, status: "waiting" },
      effects: []
    };
  }

  // ---------------------------------------------------------------------------
  // ChildWorkflowStep
  // ---------------------------------------------------------------------------

  private async executeChildWorkflowAndAdvance(
    runId: string,
    run: WorkflowRun,
    step: StepLike,
    definition: WorkflowDefinition
  ): Promise<WorkflowRunEffect> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const existing: { id: string } | null = await (this.db as any).workflowStepRun.findFirst({
      where: { runId, stepId: step.id }
    });

    let stepRunId: string;
    if (existing) {
      stepRunId = existing.id;
    } else {
      const created = await recordStepStart(this.db, runId, step.id, "child-workflow");
      stepRunId = created.id;
    }

    try {
      await executeChildWorkflowStep(
        this.db,
        runId,
        run.definitionName,
        stepRunId,
        {
          type: "child-workflow",
          id: step.id,
          ...(step.label !== undefined ? { label: step.label as string } : {}),
          workflowName: step.workflowName as string,
          ...(step.inputMapping !== undefined ? { inputMapping: step.inputMapping as Record<string, string> } : {})
        },
        run.contextJson
      );

      await this.eventBus.emit({
        workflowRunId: runId,
        eventType: "step.waiting-for-child-workflow",
        payload: { stepId: step.id }
      });

      return {
        nextRun: { ...run, status: "waiting" },
        effects: []
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordStepFailed(this.db, stepRunId, message);
      const failResult: StepResult = {
        type: "failure",
        error: { message, code: "CHILD_WORKFLOW_ERROR" }
      };
      return this.engine.advanceRun(run, failResult, definition);
    }
  }

  // ---------------------------------------------------------------------------
  // ContextPackStep — gather rich work item and codebase context
  // ---------------------------------------------------------------------------

  private async executeContextPackAndAdvance(
    runId: string,
    run: WorkflowRun,
    step: StepLike,
    definition: WorkflowDefinition
  ): Promise<WorkflowRunEffect> {
    const stepRun = await recordStepStart(this.db, runId, step.id, "context-pack");
    let stepResult: StepResult;

    try {
      const contextPackStep = {
        type: "context-pack" as const,
        id: step.id,
        label: (step.label as string | undefined) ?? step.id,
        workItemId: step.workItemId as string | undefined,
        outputKey: (step.outputKey as string | undefined) ?? "contextPack",
        includeGitDiff: (step.includeGitDiff as boolean | undefined) ?? true,
        includePreviousAttempts: (step.includePreviousAttempts as boolean | undefined) ?? true
      };

      const result = await executeContextPackStep({
        db: this.db,
        run,
        step: contextPackStep,
        planningDatabaseUrl: this.planningDatabaseUrl
      });

      await recordStepComplete(this.db, stepRun.id, {
        stepId: step.id,
        exitCode: 0,
        stdout: `context-pack gathered for ${result.workItemId}`,
        stderr: "",
        durationMs: 0,
        success: true
      });

      // Merge result into contextJson under the specified output key
      const updatedContextJson = {
        ...run.contextJson,
        [contextPackStep.outputKey]: result
      };

      // Advance the run with updated context
      const updatedRun = {
        ...run,
        contextJson: updatedContextJson
      };

      stepResult = { type: "success", output: result as Record<string, unknown> };
      const advanceResult = this.engine.advanceRun(updatedRun, stepResult, definition);

      // Return the engine's result but with the updated context already in place
      return {
        ...advanceResult,
        nextRun: {
          ...advanceResult.nextRun,
          contextJson: updatedContextJson
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordStepFailed(this.db, stepRun.id, message);
      stepResult = { type: "failure", error: { message, code: "CONTEXT_PACK_ERROR" } };
      return this.engine.advanceRun(run, stepResult, definition);
    }
  }
}
