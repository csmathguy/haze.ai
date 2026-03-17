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

