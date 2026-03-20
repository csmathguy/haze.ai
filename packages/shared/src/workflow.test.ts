import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  WorkflowEngine
} from "./workflow.js";
import type {
  WorkflowDefinition,
  WorkflowRunStatus,
  CommandStep,
  StepResult,
  WorkflowEvent
} from "./workflow-schemas.js";

describe("WorkflowEngine", () => {
  const engine = new WorkflowEngine();

  // ========================================================================
  // Test Fixtures
  // ========================================================================

  const simpleDefinition: WorkflowDefinition = {
    name: "simple-workflow",
    version: "1.0.0",
    triggers: ["manual", "api"],
    inputSchema: z.object({
      message: z.string()
    }),
    steps: [
      {
        type: "command",
        id: "step-1",
        label: "Execute command",
        scriptPath: "/path/to/script.sh",
        args: ["--flag"],
        timeoutMs: 30000,
        retryPolicy: { maxRetries: 2, backoffMs: 1000 }
      } as CommandStep
    ]
  };

  // ========================================================================
  // startRun Tests
  // ========================================================================

  describe("startRun", () => {
    it("creates a new workflow run with pending status", () => {
      const input = { message: "test" };
      const result = engine.startRun(simpleDefinition, input);

      expect(result.nextRun.status).toBe("running");
      expect(result.nextRun.definitionName).toBe("simple-workflow");
      expect(result.nextRun.version).toBe("1.0.0");
    });

    it("includes input in contextJson", () => {
      const input = { message: "hello" };
      const result = engine.startRun(simpleDefinition, input);

      expect(result.nextRun.contextJson.input).toEqual(input);
    });

    it("sets currentStepId to first step", () => {
      const result = engine.startRun(simpleDefinition, {});

      expect(result.nextRun.currentStepId).toBe("step-1");
    });

    it("generates unique run IDs", () => {
      const result1 = engine.startRun(simpleDefinition, {});
      const result2 = engine.startRun(simpleDefinition, {});

      expect(result1.nextRun.id).not.toBe(result2.nextRun.id);
    });

    it("produces execute-step effect for first step", () => {
      const result = engine.startRun(simpleDefinition, {});

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("execute-step");
      if (result.effects[0]?.type === "execute-step") {
        expect(result.effects[0].step.id).toBe("step-1");
      }
    });

    it("completes immediately if workflow has no steps", () => {
      const emptyDef: WorkflowDefinition = {
        name: "empty",
        version: "1.0.0",
        triggers: ["manual"],
        inputSchema: z.object({}),
        steps: []
      };
      const result = engine.startRun(emptyDef, {});

      expect(result.nextRun.status).toBe("completed");
      expect(result.nextRun.completedAt).toBeDefined();
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("complete-run");
    });

    it("sets startedAt and updatedAt timestamps", () => {
      const before = new Date();
      const result = engine.startRun(simpleDefinition, {});
      const after = new Date();

      const startedAt = new Date(result.nextRun.startedAt);
      const updatedAt = new Date(result.nextRun.updatedAt);

      expect(startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("includes metadata in context", () => {
      const result = engine.startRun(simpleDefinition, {});

      const metadata = result.nextRun.contextJson.metadata as Record<string, unknown>;
      expect(metadata).toBeDefined();
      expect(metadata.startedAt).toBeDefined();
    });
  });

  // ========================================================================
  // advanceRun Tests
  // ========================================================================

  describe("advanceRun", () => {
    it("transitions to completed on step success", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const stepResult: StepResult = {
        type: "success",
        output: { result: "done" }
      };
      const advanceResult = engine.advanceRun(run, stepResult);

      expect(advanceResult.nextRun.status).toBe("completed");
      expect(advanceResult.nextRun.completedAt).toBeDefined();
    });

    it("produces complete-run effect on success", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const stepResult: StepResult = {
        type: "success",
        output: { result: "done" }
      };
      const advanceResult = engine.advanceRun(run, stepResult);

      expect(advanceResult.effects).toHaveLength(1);
      expect(advanceResult.effects[0]?.type).toBe("complete-run");
    });

    it("includes step output in updated context", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const stepOutput = { result: "success", value: 42 };
      const stepResult: StepResult = {
        type: "success",
        output: stepOutput
      };
      const advanceResult = engine.advanceRun(run, stepResult);

      const stepId = run.currentStepId ?? "unknown";
      const stepKey = `step_${stepId}`;
      expect(advanceResult.nextRun.contextJson[stepKey]).toEqual(stepOutput);
    });

    it("transitions to failed on step failure", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const stepResult: StepResult = {
        type: "failure",
        error: { message: "Command failed", code: "EXEC_ERROR" }
      };
      const advanceResult = engine.advanceRun(run, stepResult);

      expect(advanceResult.nextRun.status).toBe("failed");
      expect(advanceResult.nextRun.completedAt).toBeDefined();
    });

    it("produces fail-run effect on failure", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const stepResult: StepResult = {
        type: "failure",
        error: { message: "Something went wrong" }
      };
      const advanceResult = engine.advanceRun(run, stepResult);

      expect(advanceResult.effects).toHaveLength(1);
      expect(advanceResult.effects[0]?.type).toBe("fail-run");
      if (advanceResult.effects[0]?.type === "fail-run") {
        expect(advanceResult.effects[0].error.message).toBe("Something went wrong");
      }
    });

    it("updates timestamp on advance", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;
      const originalUpdatedAt = new Date(run.updatedAt);

      // Small delay to ensure timestamp difference
      const stepResult: StepResult = { type: "success" };
      const advanceResult = engine.advanceRun(run, stepResult);
      const newUpdatedAt = new Date(advanceResult.nextRun.updatedAt);

      expect(newUpdatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it("preserves prior context data", () => {
      const startResult = engine.startRun(simpleDefinition, { message: "test" });
      const run = startResult.nextRun;

      const stepResult: StepResult = {
        type: "success",
        output: { step1Result: "success" }
      };
      const advanceResult = engine.advanceRun(run, stepResult);

      expect(advanceResult.nextRun.contextJson.input).toEqual({ message: "test" });
    });
  });

  // ========================================================================
  // signalRun Tests
  // ========================================================================

  describe("signalRun", () => {
    it("updates context with event data", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const event: WorkflowEvent = {
        type: "approval-granted",
        payload: { approver: "user123" }
      };
      const result = engine.signalRun(run, event);

      const lastEvent = result.nextRun.contextJson.lastEvent as Record<string, unknown>;
      expect(lastEvent).toBeDefined();
      expect(lastEvent.type).toBe("approval-granted");
      expect(lastEvent.payload).toEqual({ approver: "user123" });
    });

    it("produces emit-event effect with processed suffix", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const event: WorkflowEvent = {
        type: "user-response"
      };
      const result = engine.signalRun(run, event);

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("emit-event");
      if (result.effects[0]?.type === "emit-event") {
        expect(result.effects[0].eventType).toBe("user-response-processed");
        expect(result.effects[0].payload?.runId).toBe(run.id);
      }
    });

    it("includes event timestamp in context", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const before = new Date();
      const event: WorkflowEvent = { type: "signal" };
      const result = engine.signalRun(run, event);
      const after = new Date();

      const lastEvent = result.nextRun.contextJson.lastEvent as Record<string, unknown>;
      const eventTs = new Date(lastEvent.receivedAt as string);
      expect(eventTs.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(eventTs.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("handles event without payload", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const event: WorkflowEvent = { type: "timeout" };
      const result = engine.signalRun(run, event);

      const lastEvent = result.nextRun.contextJson.lastEvent as Record<string, unknown>;
      expect(lastEvent.payload).toBeUndefined();
    });

    it("updates timestamp", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;
      const originalUpdatedAt = new Date(run.updatedAt);

      const event: WorkflowEvent = { type: "signal" };
      const result = engine.signalRun(run, event);
      const newUpdatedAt = new Date(result.nextRun.updatedAt);

      expect(newUpdatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  // ========================================================================
  // cancelRun Tests
  // ========================================================================

  describe("cancelRun", () => {
    it("transitions run to cancelled status", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const result = engine.cancelRun(run);

      expect(result.nextRun.status).toBe("cancelled");
    });

    it("sets completedAt timestamp", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const result = engine.cancelRun(run);

      expect(result.nextRun.completedAt).toBeDefined();
    });

    it("produces fail-run effect with CANCELLED code", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const result = engine.cancelRun(run);

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("fail-run");
      if (result.effects[0]?.type === "fail-run") {
        expect(result.effects[0].error.message).toBe("Workflow cancelled");
        expect(result.effects[0].error.code).toBe("CANCELLED");
      }
    });

    it("can cancel a running workflow", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const runningRun = startResult.nextRun;

      expect(runningRun.status).toBe("running");

      const cancelResult = engine.cancelRun(runningRun);

      expect(cancelResult.nextRun.status).toBe("cancelled");
    });

    it("can cancel a waiting workflow", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const waitingRun = {
        ...startResult.nextRun,
        status: "waiting" as WorkflowRunStatus
      };

      const cancelResult = engine.cancelRun(waitingRun);

      expect(cancelResult.nextRun.status).toBe("cancelled");
    });
  });


  // ========================================================================
  // Type Safety Tests (Compile-Time, but Verified with Runtime Checks)
  // ========================================================================

});

// ============================================================================
// ParallelStep Tests
// ============================================================================

describe("WorkflowEngine - ParallelStep Execution", () => {
  const engine = new WorkflowEngine();

  const parallelDefinition: WorkflowDefinition = {
    name: "parallel-workflow",
    version: "1.0.0",
    triggers: ["manual"],
    inputSchema: z.object({ data: z.string() }),
    steps: [
      {
        type: "parallel",
        id: "parallel-1",
        label: "Execute parallel branches",
        branches: [
          [
            {
              type: "command",
              id: "branch-1-step-1",
              label: "Branch 1 step 1",
              scriptPath: "/path/to/script1.sh"
            } as CommandStep
          ],
          [
            {
              type: "command",
              id: "branch-2-step-1",
              label: "Branch 2 step 1",
              scriptPath: "/path/to/script2.sh"
            } as CommandStep
          ]
        ]
      }
    ]
  };

  describe("executeParallelStep", () => {
    it("creates effects to execute the first step of each branch", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = startResult.nextRun;

      // Simulate starting a parallel step
      const parallelStep = parallelDefinition.steps[0] as any;
      const result = engine.executeParallelStep(run, parallelStep);

      // Should generate execute-step effects for each branch's first step
      expect(result.effects).toHaveLength(2);
      expect(result.effects[0]?.type).toBe("execute-step");
      expect(result.effects[1]?.type).toBe("execute-step");
    });

    it("initializes branch tracking in context", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const result = engine.executeParallelStep(run, parallelStep);

      const parallelState = result.nextRun.contextJson.parallel_1 as Record<string, unknown>;
      expect(parallelState).toBeDefined();
      expect(parallelState.totalBranches).toBe(2);
      expect(parallelState.completedBranches).toBe(0);
      expect(parallelState.failedBranch).toBeNull();
    });

    it("initializes branch states", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const result = engine.executeParallelStep(run, parallelStep);

      const parallelState = result.nextRun.contextJson.parallel_1 as Record<string, unknown>;
      const branchStates = parallelState.branchStates as Record<string, Record<string, unknown>>;

      expect(branchStates.branch_0).toBeDefined();
      expect(branchStates.branch_0?.status).toBe("running");
      expect(branchStates.branch_1).toBeDefined();
      expect(branchStates.branch_1?.status).toBe("running");
    });

    it("handles empty branches edge case", () => {
      const emptyParallelDef: WorkflowDefinition = {
        name: "empty-parallel",
        version: "1.0.0",
        triggers: ["manual"],
        inputSchema: z.object({}),
        steps: [
          {
            type: "parallel",
            id: "parallel-empty",
            label: "Empty parallel",
            branches: []
          }
        ]
      };

      const startResult = engine.startRun(emptyParallelDef, {});
      const run = startResult.nextRun;

      const parallelStep = emptyParallelDef.steps[0] as any;
      const result = engine.executeParallelStep(run, parallelStep);

      expect(result.nextRun.status).toBe("completed");
      expect(result.nextRun.completedAt).toBeDefined();
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("complete-run");
    });

    it("keeps parallel step in running state", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const result = engine.executeParallelStep(run, parallelStep);

      expect(result.nextRun.status).toBe("running");
      expect(result.nextRun.completedAt).toBeUndefined();
    });
  });

  describe("completeBranchInParallelStep", () => {
    it("marks branch as success when branch succeeds", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      const branchResult: StepResult = {
        type: "success",
        output: { result: "branch1_done" }
      };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, branchResult);

      const parallelState = completeResult.nextRun.contextJson.parallel_1 as Record<string, unknown>;
      const branchStates = parallelState.branchStates as Record<string, Record<string, unknown>>;
      expect(branchStates.branch_0?.status).toBe("success");
    });

    it("increments completed branches count on success", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      const branchResult: StepResult = {
        type: "success",
        output: { result: "branch1_done" }
      };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, branchResult);

      const parallelState = completeResult.nextRun.contextJson.parallel_1 as Record<string, unknown>;
      expect(parallelState.completedBranches).toBe(1);
    });

    it("stores branch output in context", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      const branchOutput = { result: "branch1_output", value: 42 };
      const branchResult: StepResult = {
        type: "success",
        output: branchOutput
      };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, branchResult);

      expect(completeResult.nextRun.contextJson.branch_parallel_1_0_output).toEqual(branchOutput);
    });

    it("completes parallel step when all branches succeed", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      // Complete first branch
      let result = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "success",
        output: { result: "branch0_done" }
      });
      run = result.nextRun;

      // Complete second branch - should complete the parallel step
      result = engine.completeBranchInParallelStep(run, "parallel-1", 1, {
        type: "success",
        output: { result: "branch1_done" }
      });

      expect(result.nextRun.status).toBe("completed");
      expect(result.nextRun.completedAt).toBeDefined();
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("complete-run");
    });

    it("fails parallel step when any branch fails", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      const failureResult: StepResult = {
        type: "failure",
        error: { message: "Branch 0 failed", code: "BRANCH_ERROR" }
      };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, failureResult);

      expect(completeResult.nextRun.status).toBe("failed");
      expect(completeResult.nextRun.completedAt).toBeDefined();
      expect(completeResult.effects).toHaveLength(1);
      expect(completeResult.effects[0]?.type).toBe("fail-run");
    });

    it("marks branch as failed when branch fails", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      const failureResult: StepResult = {
        type: "failure",
        error: { message: "Something went wrong" }
      };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 1, failureResult);

      const parallelState = completeResult.nextRun.contextJson.parallel_1 as Record<string, unknown>;
      const branchStates = parallelState.branchStates as Record<string, Record<string, unknown>>;
      expect(branchStates.branch_1?.status).toBe("failure");
      expect(branchStates.branch_1?.error).toEqual({ message: "Something went wrong" });
    });

    it("records failed branch information", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      const failureResult: StepResult = {
        type: "failure",
        error: { message: "Branch failed", code: "TEST_ERROR" }
      };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, failureResult);

      const parallelState = completeResult.nextRun.contextJson.parallel_1 as Record<string, unknown>;
      expect(parallelState.failedBranch).toBeDefined();
      const failedBranch = parallelState.failedBranch as Record<string, unknown>;
      expect(failedBranch.index).toBe(0);
      expect(failedBranch.error).toEqual({ message: "Branch failed", code: "TEST_ERROR" });
    });

    it("keeps parallel step in running state until all branches complete", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      // Complete first branch - should stay running
      const result = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "success",
        output: { result: "branch0_done" }
      });

      expect(result.nextRun.status).toBe("running");
      expect(result.effects).toHaveLength(0);
    });

    it("includes error message with branch index on failure", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as any;
      const executeResult = engine.executeParallelStep(run, parallelStep);
      run = executeResult.nextRun;

      const failureResult: StepResult = {
        type: "failure",
        error: { message: "Custom error" }
      };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 1, failureResult);

      if (completeResult.effects[0]?.type === "fail-run") {
        expect(completeResult.effects[0].error.message).toContain("Branch 1 failed");
        expect(completeResult.effects[0].error.message).toContain("Custom error");
      }
    });
  });
});

