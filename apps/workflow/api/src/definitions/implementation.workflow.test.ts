import { describe, it, expect } from "vitest";
import { implementationWorkflow } from "./implementation.workflow.js";

describe("Implementation Workflow Definition", () => {
  it("should have correct name and version", () => {
    expect(implementationWorkflow.name).toBe("implementation");
    expect(implementationWorkflow.version).toBe("1.0.0");
  });

  it("should have manual trigger", () => {
    expect(implementationWorkflow.triggers).toContain("manual");
  });

  it("should have input schema", () => {
    expect(implementationWorkflow.inputSchema).toBeDefined();
  });

  it("should have all required steps", () => {
    const steps = implementationWorkflow.steps;
    expect(steps.length).toBeGreaterThan(0);

    const stepIds = steps.map((s) => s.id);
    // Phase 1
    expect(stepIds).toContain("phase-1-check-planning-item");

    // Phase 2
    expect(stepIds).toContain("phase-2-create-worktree");

    // Phase 3
    expect(stepIds).toContain("phase-3-implement");

    // Phase 4
    expect(stepIds).toContain("phase-4-guardrails");

    // Phase 5
    expect(stepIds).toContain("phase-5-commit");
    expect(stepIds).toContain("phase-5-pr-review");
  });

  it("should have planning check as condition step", () => {
    const step = implementationWorkflow.steps.find(
      (s) => s.id === "phase-1-check-planning-item"
    );
    expect(step).toBeDefined();
    expect(step?.type).toBe("condition");
  });

  it("should have worktree creation as command step", () => {
    const step = implementationWorkflow.steps.find(
      (s) => s.id === "phase-2-create-worktree"
    );
    expect(step).toBeDefined();
    expect(step?.type).toBe("command");
  });

  it("should have implementation as agent step", () => {
    const step = implementationWorkflow.steps.find(
      (s) => s.id === "phase-3-implement"
    );
    expect(step).toBeDefined();
    expect(step?.type).toBe("agent");
  });

  it("should have parallel guardrails", () => {
    const step = implementationWorkflow.steps.find(
      (s) => s.id === "phase-4-guardrails"
    );
    expect(step).toBeDefined();
    expect(step?.type).toBe("parallel");
  });

  it("should have PR review approval gate", () => {
    const step = implementationWorkflow.steps.find(
      (s) => s.id === "phase-5-pr-review"
    );
    expect(step).toBeDefined();
    expect(step?.type).toBe("approval");
  });

  it("should have deterministic command steps with script paths", () => {
    const commandSteps = implementationWorkflow.steps.filter(
      (s) => s.type === "command"
    );
    expect(commandSteps.length).toBeGreaterThan(0);
  });

  it("should have retry policies on some steps", () => {
    const stepsWithRetry = implementationWorkflow.steps.filter(
      (s) => "retryPolicy" in s && s.retryPolicy
    );
    expect(stepsWithRetry.length).toBeGreaterThan(0);
  });

  it("should have workflow-level timeout", () => {
    expect(implementationWorkflow.timeoutMs).toBe(36000000); // 10 hours
  });

  it("should have step IDs in kebab-case", () => {
    const steps = implementationWorkflow.steps;
    steps.forEach((step) => {
      expect(step.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });
  });

  it("should have descriptive labels for all steps", () => {
    const steps = implementationWorkflow.steps;
    steps.forEach((step) => {
      expect(step.label).toBeTruthy();
    });
  });
});
