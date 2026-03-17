import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  WorkflowEngine
} from "./workflow.js";
import type {
  WorkflowDefinition,
  CommandStep,
  ApprovalStep,
  TimerStep,
  WaitForEventStep,
  WorkflowEvent
} from "./workflow-schemas.js";

describe("WorkflowEngine - Integration Tests", () => {
  const engine = new WorkflowEngine();

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

  const multiStepDefinition: WorkflowDefinition = {
    name: "multi-step",
    version: "1.0.0",
    triggers: ["manual"],
    inputSchema: z.object({ data: z.string() }),
    steps: [
      {
        type: "command",
        id: "cmd-1",
        label: "First command",
        scriptPath: "/path/to/script1.sh"
      } as CommandStep,
      {
        type: "command",
        id: "cmd-2",
        label: "Second command",
        scriptPath: "/path/to/script2.sh"
      } as CommandStep
    ]
  };

  describe("Complex Scenarios", () => {
    it("handles workflow with multiple steps", () => {
      const result = engine.startRun(multiStepDefinition, {});

      expect(result.nextRun.currentStepId).toBe("cmd-1");
      expect(result.effects[0]?.type).toBe("execute-step");
    });

    it("accumulates context across multiple signal calls", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      let run = startResult.nextRun;

      const event1: WorkflowEvent = {
        type: "signal-1",
        payload: { data: "first" }
      };
      const result1 = engine.signalRun(run, event1);
      run = result1.nextRun;

      const event2: WorkflowEvent = {
        type: "signal-2",
        payload: { data: "second" }
      };
      const result2 = engine.signalRun(run, event2);
      run = result2.nextRun;

      const lastEvent = run.contextJson.lastEvent as Record<string, unknown>;
      expect(lastEvent.type).toBe("signal-2");
      const payload = lastEvent.payload as Record<string, unknown>;
      expect(payload.data).toBe("second");
    });

    it("maintains context isolation between runs", () => {
      const result1 = engine.startRun(simpleDefinition, { runId: 1 });
      const result2 = engine.startRun(simpleDefinition, { runId: 2 });

      expect(result1.nextRun.id).not.toBe(result2.nextRun.id);
      expect(result1.nextRun.contextJson.input).toEqual({ runId: 1 });
      expect(result2.nextRun.contextJson.input).toEqual({ runId: 2 });
    });
  });

  describe("State Machine Invariants", () => {
    it("preserves run ID across transitions", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const originalId = startResult.nextRun.id;

      const advanceResult = engine.advanceRun(startResult.nextRun, {
        type: "success"
      });

      expect(advanceResult.nextRun.id).toBe(originalId);
    });

    it("preserves definition metadata across transitions", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const advanceResult = engine.advanceRun(run, { type: "success" });

      expect(advanceResult.nextRun.definitionName).toBe("simple-workflow");
      expect(advanceResult.nextRun.version).toBe("1.0.0");
    });

    it("endedAt is only set in terminal states", () => {
      const startResult = engine.startRun(multiStepDefinition, {});
      expect(startResult.nextRun.completedAt).toBeUndefined();

      const advanceResult = engine.advanceRun(startResult.nextRun, {
        type: "success"
      });
      expect(advanceResult.nextRun.completedAt).toBeDefined();
    });

    it("failed state is terminal", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const failResult = engine.advanceRun(run, {
        type: "failure",
        error: { message: "Error" }
      });

      expect(failResult.nextRun.status).toBe("failed");
      expect(failResult.nextRun.completedAt).toBeDefined();
    });

    it("completed state is terminal", () => {
      const startResult = engine.startRun(simpleDefinition, {});
      const run = startResult.nextRun;

      const completeResult = engine.advanceRun(run, {
        type: "success"
      });

      expect(completeResult.nextRun.status).toBe("completed");
      expect(completeResult.nextRun.completedAt).toBeDefined();
    });

    it("cancelled state is terminal", () => {
      const startResult = engine.startRun(simpleDefinition, {});

      const cancelResult = engine.cancelRun(startResult.nextRun);

      expect(cancelResult.nextRun.status).toBe("cancelled");
      expect(cancelResult.nextRun.completedAt).toBeDefined();
    });
  });

  describe("Type System", () => {
    it("accepts CommandStep type", () => {
      const step: CommandStep = {
        type: "command",
        id: "cmd-1",
        label: "Run command",
        scriptPath: "/path/to/script"
      };

      expect(step.type).toBe("command");
    });

    it("accepts ApprovalStep type", () => {
      const step: ApprovalStep = {
        type: "approval",
        id: "approval-1",
        label: "Approve",
        prompt: "Do you approve?"
      };

      expect(step.type).toBe("approval");
    });

    it("accepts TimerStep type", () => {
      const step: TimerStep = {
        type: "timer",
        id: "timer-1",
        label: "Wait",
        durationMs: 5000
      };

      expect(step.type).toBe("timer");
    });

    it("accepts WaitForEventStep type", () => {
      const step: WaitForEventStep = {
        type: "wait-for-event",
        id: "wait-1",
        label: "Wait for event",
        eventType: "user-response"
      };

      expect(step.type).toBe("wait-for-event");
    });

    it("definition accepts input schema", () => {
      const inputSchema = z.object({
        name: z.string(),
        count: z.number()
      });

      const def: WorkflowDefinition = {
        name: "test",
        version: "1.0",
        triggers: ["manual"],
        inputSchema,
        steps: []
      };

      expect(def.inputSchema).toBe(inputSchema);
    });
  });
});
