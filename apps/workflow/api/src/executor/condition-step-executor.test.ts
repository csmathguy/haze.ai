import { describe, it, expect } from "vitest";
import { ConditionStepExecutor } from "./condition-step-executor.js";
import type { ConditionStep, WorkflowRun } from "@taxes/shared";

describe("ConditionStepExecutor", () => {
  const executor = new ConditionStepExecutor();

  const createWorkflowRun = (contextOverrides: Record<string, unknown> = {}): WorkflowRun => ({
    id: "run-1",
    definitionName: "test-workflow",
    version: "1.0.0",
    status: "running",
    currentStepId: "condition-step-1",
    contextJson: {
      input: { flag: true, value: 42 },
      ...contextOverrides
    },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const createConditionStep = (overrides: Partial<ConditionStep> = {}): ConditionStep => {
    const step: ConditionStep = {
      type: "condition",
      id: "condition-step-1",
      label: "Check condition",
      condition: (context) => {
        const input = context.input as Record<string, unknown> & { flag?: unknown };
        return Boolean(input.flag);
      },
      trueBranch: [],
      falseBranch: []
    };
    return { ...step, ...overrides } as ConditionStep;
  };

  describe("evaluate true branch", () => {
    it("selects true branch when condition evaluates to true", () => {
      const run = createWorkflowRun();
      const step = createConditionStep({
        condition: (context) => {
          const input = context.input as Record<string, unknown> & { flag?: unknown };
          return Boolean(input.flag);
        }
      });

      const result = executor.execute(run, step);

      expect(result.stepId).toBe("condition-step-1");
      expect(result.selectedBranch).toBe("true");
      expect(result.conditionValue).toBe(true);
    });

    it("takes true branch with complex context comparison", () => {
      const run = createWorkflowRun({
        step_1: { exitCode: 0 }
      });
      const step = createConditionStep({
        condition: (context) => {
          const step1 = context.step_1 as Record<string, unknown> | undefined;
          return step1?.exitCode === 0;
        }
      });

      const result = executor.execute(run, step);

      expect(result.selectedBranch).toBe("true");
      expect(result.conditionValue).toBe(true);
    });
  });

  describe("evaluate false branch", () => {
    it("selects false branch when condition evaluates to false", () => {
      const run = createWorkflowRun({
        input: { flag: false }
      });
      const step = createConditionStep({
        condition: (context) => {
          const input = context.input as Record<string, unknown> & { flag?: unknown };
          return Boolean(input.flag);
        }
      });

      const result = executor.execute(run, step);

      expect(result.stepId).toBe("condition-step-1");
      expect(result.selectedBranch).toBe("false");
      expect(result.conditionValue).toBe(false);
    });

    it("takes false branch with complex context", () => {
      const run = createWorkflowRun({
        step_1: { exitCode: 1 }
      });
      const step = createConditionStep({
        condition: (context) => {
          const step1 = context.step_1 as Record<string, unknown> | undefined;
          return step1?.exitCode === 0;
        }
      });

      const result = executor.execute(run, step);

      expect(result.selectedBranch).toBe("false");
      expect(result.conditionValue).toBe(false);
    });
  });

  describe("default branch behavior", () => {
    it("handles condition with no matching context gracefully", () => {
      const run = createWorkflowRun({
        input: {}
      });
      const step = createConditionStep({
        condition: (context) => {
          // Returns false when context.input.flag is undefined
          const input = context.input as Record<string, unknown> & { flag?: unknown };
          return Boolean(input.flag);
        }
      });

      const result = executor.execute(run, step);

      expect(result.selectedBranch).toBe("false");
      expect(result.conditionValue).toBe(false);
    });

    it("handles missing step_N references as false", () => {
      const run = createWorkflowRun({
        // No step_99 in context
      });
      const step = createConditionStep({
        condition: (context) => {
          const stepData = context.step_99 as Record<string, unknown> | undefined;
          if (!stepData) return false;
          return stepData.success === true;
        }
      });

      const result = executor.execute(run, step);

      expect(result.selectedBranch).toBe("false");
      expect(result.conditionValue).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws error when condition function throws", () => {
      const run = createWorkflowRun();
      const step = createConditionStep({
        condition: () => {
          throw new Error("Evaluation failed");
        }
      });

      expect(() => executor.execute(run, step)).toThrow("Failed to evaluate condition step");
      expect(() => executor.execute(run, step)).toThrow("Evaluation failed");
    });

    it("throws error with descriptive message on condition error", () => {
      const run = createWorkflowRun();
      const step = createConditionStep({
        id: "my-condition",
        condition: () => {
          throw new ReferenceError("undefined variable");
        }
      });

      expect(() => executor.execute(run, step)).toThrow(/my-condition/);
      expect(() => executor.execute(run, step)).toThrow(/undefined variable/);
    });

    it("handles non-Error exceptions in condition", () => {
      const run = createWorkflowRun();
      const step = createConditionStep({
        condition: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "string error";
        }
      });

      expect(() => executor.execute(run, step)).toThrow("Failed to evaluate condition step");
    });
  });

  describe("duration tracking", () => {
    it("records execution duration", () => {
      const run = createWorkflowRun();
      const step = createConditionStep({
        condition: (context) => {
          const input = context.input as Record<string, unknown> & { flag?: unknown };
          return Boolean(input.flag);
        }
      });

      const result = executor.execute(run, step);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe("number");
    });

    it("records reasonable duration for simple conditions", () => {
      const run = createWorkflowRun();
      const step = createConditionStep({
        condition: () => true
      });

      const result = executor.execute(run, step);

      // Simple condition should complete in less than 100ms
      expect(result.durationMs).toBeLessThan(100);
    });
  });

  describe("complex conditions", () => {
    it("evaluates multi-part boolean logic", () => {
      const run = createWorkflowRun({
        input: { hasPermission: true, isAdmin: false }
      });
      const step = createConditionStep({
        condition: (context) => {
          const input = context.input as Record<string, unknown> & {
            hasPermission?: unknown;
            isAdmin?: unknown;
          };
          return input.hasPermission === true && input.isAdmin !== true;
        }
      });

      const result = executor.execute(run, step);

      expect(result.conditionValue).toBe(true);
      expect(result.selectedBranch).toBe("true");
    });

    it("evaluates conditions with array checks", () => {
      const run = createWorkflowRun({
        input: { items: ["a", "b", "c"] }
      });
      const step = createConditionStep({
        condition: (context) => {
          const input = context.input as Record<string, unknown> & { items?: unknown };
          const itemsList = input.items as unknown[] | undefined;
          return Array.isArray(itemsList) && itemsList.length > 0;
        }
      });

      const result = executor.execute(run, step);

      expect(result.conditionValue).toBe(true);
      expect(result.selectedBranch).toBe("true");
    });

    it("evaluates string comparisons", () => {
      const run = createWorkflowRun({
        input: { status: "success" }
      });
      const step = createConditionStep({
        condition: (context) => {
          const input = context.input as Record<string, unknown> & { status?: unknown };
          return input.status === "success" || input.status === "completed";
        }
      });

      const result = executor.execute(run, step);

      expect(result.selectedBranch).toBe("true");
    });
  });

  describe("branch selection consistency", () => {
    it("returns same branch for deterministic conditions", () => {
      const run = createWorkflowRun();
      const step = createConditionStep({
        condition: () => true
      });

      const result1 = executor.execute(run, step);
      const result2 = executor.execute(run, step);

      expect(result1.selectedBranch).toBe(result2.selectedBranch);
      expect(result1.conditionValue).toBe(result2.conditionValue);
    });
  });
});
