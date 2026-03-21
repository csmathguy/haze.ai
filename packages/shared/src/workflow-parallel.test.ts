import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  WorkflowEngine
} from "./workflow.js";
import type {
  WorkflowDefinition,
  CommandStep,
  ParallelStep,
  StepResult
} from "./workflow-schemas.js";

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

      const parallelStep = parallelDefinition.steps[0] as ParallelStep;
      const result = engine.executeParallelStep(run, parallelStep);

      expect(result.effects).toHaveLength(2);
      expect(result.effects[0]?.type).toBe("execute-step");
      expect(result.effects[1]?.type).toBe("execute-step");
    });

    it("initializes branch tracking in context", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as ParallelStep;
      const result = engine.executeParallelStep(run, parallelStep);

      const parallelState = result.nextRun.contextJson["parallel_parallel-1"] as Record<string, unknown>;
      expect(parallelState).toBeDefined();
      expect(parallelState.totalBranches).toBe(2);
      expect(parallelState.completedBranches).toBe(0);
      expect(parallelState.failedBranch).toBeNull();
    });

    it("initializes branch states", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as ParallelStep;
      const result = engine.executeParallelStep(run, parallelStep);

      const parallelState = result.nextRun.contextJson["parallel_parallel-1"] as Record<string, unknown>;
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

      const parallelStep = emptyParallelDef.steps[0] as ParallelStep;
      const result = engine.executeParallelStep(run, parallelStep);

      expect(result.nextRun.status).toBe("completed");
      expect(result.nextRun.completedAt).toBeDefined();
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe("complete-run");
    });

    it("keeps parallel step in running state", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as ParallelStep;
      const result = engine.executeParallelStep(run, parallelStep);

      expect(result.nextRun.status).toBe("running");
      expect(result.nextRun.completedAt).toBeUndefined();
    });
  });

  describe("completeBranchInParallelStep", () => {
    it("marks branch as success when branch succeeds", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      const parallelStep = parallelDefinition.steps[0] as ParallelStep;
      run = engine.executeParallelStep(run, parallelStep).nextRun;

      const branchResult: StepResult = { type: "success", output: { result: "branch1_done" } };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, branchResult);

      const parallelState = completeResult.nextRun.contextJson["parallel_parallel-1"] as Record<string, unknown>;
      const branchStates = parallelState.branchStates as Record<string, Record<string, unknown>>;
      expect(branchStates.branch_0?.status).toBe("success");
    });

    it("increments completed branches count on success", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      run = engine.executeParallelStep(run, parallelDefinition.steps[0] as ParallelStep).nextRun;
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "success", output: { result: "branch1_done" }
      });

      const parallelState = completeResult.nextRun.contextJson["parallel_parallel-1"] as Record<string, unknown>;
      expect(parallelState.completedBranches).toBe(1);
    });

    it("stores branch output in context", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = startResult.nextRun;

      run = engine.executeParallelStep(run, parallelDefinition.steps[0] as ParallelStep).nextRun;
      const branchOutput = { result: "branch1_output", value: 42 };
      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "success", output: branchOutput
      });

      expect(completeResult.nextRun.contextJson["branch_parallel-1_0_output"]).toEqual(branchOutput);
    });

    it("completes parallel step when all branches succeed", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      let run = engine.executeParallelStep(startResult.nextRun, parallelDefinition.steps[0] as ParallelStep).nextRun;

      run = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "success", output: { result: "branch0_done" }
      }).nextRun;
      const result = engine.completeBranchInParallelStep(run, "parallel-1", 1, {
        type: "success", output: { result: "branch1_done" }
      });

      expect(result.nextRun.status).toBe("completed");
      expect(result.nextRun.completedAt).toBeDefined();
      expect(result.effects[0]?.type).toBe("complete-run");
    });

    it("fails parallel step when any branch fails", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = engine.executeParallelStep(startResult.nextRun, parallelDefinition.steps[0] as ParallelStep).nextRun;

      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "failure", error: { message: "Branch 0 failed", code: "BRANCH_ERROR" }
      });

      expect(completeResult.nextRun.status).toBe("failed");
      expect(completeResult.effects[0]?.type).toBe("fail-run");
    });

    it("marks branch as failed when branch fails", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = engine.executeParallelStep(startResult.nextRun, parallelDefinition.steps[0] as ParallelStep).nextRun;

      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 1, {
        type: "failure", error: { message: "Something went wrong" }
      });

      const parallelState = completeResult.nextRun.contextJson["parallel_parallel-1"] as Record<string, unknown>;
      const branchStates = parallelState.branchStates as Record<string, Record<string, unknown>>;
      expect(branchStates.branch_1?.status).toBe("failure");
      expect(branchStates.branch_1?.error).toEqual({ message: "Something went wrong" });
    });

    it("records failed branch information", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = engine.executeParallelStep(startResult.nextRun, parallelDefinition.steps[0] as ParallelStep).nextRun;

      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "failure", error: { message: "Branch failed", code: "TEST_ERROR" }
      });

      const parallelState = completeResult.nextRun.contextJson["parallel_parallel-1"] as Record<string, unknown>;
      expect(parallelState.failedBranch).toBeDefined();
      const failedBranch = parallelState.failedBranch as Record<string, unknown>;
      expect(failedBranch.index).toBe(0);
      expect(failedBranch.error).toEqual({ message: "Branch failed", code: "TEST_ERROR" });
    });

    it("keeps parallel step in running state until all branches complete", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = engine.executeParallelStep(startResult.nextRun, parallelDefinition.steps[0] as ParallelStep).nextRun;

      const result = engine.completeBranchInParallelStep(run, "parallel-1", 0, {
        type: "success", output: { result: "branch0_done" }
      });

      expect(result.nextRun.status).toBe("running");
      expect(result.effects).toHaveLength(0);
    });

    it("includes error message with branch index on failure", () => {
      const startResult = engine.startRun(parallelDefinition, { data: "test" });
      const run = engine.executeParallelStep(startResult.nextRun, parallelDefinition.steps[0] as ParallelStep).nextRun;

      const completeResult = engine.completeBranchInParallelStep(run, "parallel-1", 1, {
        type: "failure", error: { message: "Custom error" }
      });

      if (completeResult.effects[0]?.type === "fail-run") {
        expect(completeResult.effects[0].error.message).toContain("Branch 1 failed");
        expect(completeResult.effects[0].error.message).toContain("Custom error");
      }
    });
  });
});
