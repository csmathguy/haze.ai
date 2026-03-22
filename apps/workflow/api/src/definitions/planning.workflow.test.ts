import { describe, it, expect } from "vitest";
import { planningWorkflow } from "./planning.workflow.js";

describe("Planning Workflow Definition", () => {
  it("should have correct name and version", () => {
    expect(planningWorkflow.name).toBe("planning");
    expect(planningWorkflow.version).toBe("1.0.0");
  });

  it("should have manual trigger", () => {
    expect(planningWorkflow.triggers).toContain("manual");
  });

  it("should have input schema", () => {
    expect(planningWorkflow.inputSchema).toBeDefined();
  });

  it("should have all required phase steps", () => {
    const stepIds = planningWorkflow.steps.map((s) => s.id);

    // Phase 0: Entry
    expect(stepIds).toContain("phase-0-idea-capture");

    // Phase 1: Discovery
    expect(stepIds).toContain("phase-1-discovery-questions");
    expect(stepIds).toContain("phase-1-discovery-answers");

    // Phase 2: Options
    expect(stepIds).toContain("phase-2-options");
    expect(stepIds).toContain("phase-2-option-selection");

    // Phase 3: Draft
    expect(stepIds).toContain("phase-3-draft-work-item");
    expect(stepIds).toContain("phase-3-draft-review");
  });

  it("should have 7 steps total", () => {
    expect(planningWorkflow.steps).toHaveLength(7);
  });

  it("should have idea-capture as approval step", () => {
    const step = planningWorkflow.steps.find((s) => s.id === "phase-0-idea-capture");
    expect(step).toBeDefined();
    expect(step?.type).toBe("approval");
  });

  it("should have discovery-questions as agent step", () => {
    const step = planningWorkflow.steps.find((s) => s.id === "phase-1-discovery-questions");
    expect(step).toBeDefined();
    expect(step?.type).toBe("agent");
  });

  it("should have options as agent step", () => {
    const step = planningWorkflow.steps.find((s) => s.id === "phase-2-options");
    expect(step).toBeDefined();
    expect(step?.type).toBe("agent");
  });

  it("should have draft-work-item as agent step", () => {
    const step = planningWorkflow.steps.find((s) => s.id === "phase-3-draft-work-item");
    expect(step).toBeDefined();
    expect(step?.type).toBe("agent");
  });

  it("should have approval gates at each phase boundary", () => {
    const approvalSteps = planningWorkflow.steps.filter((s) => s.type === "approval");
    expect(approvalSteps).toHaveLength(4);
  });

  it("should have agent steps with anthropic provider", () => {
    const agentSteps = planningWorkflow.steps.filter((s) => s.type === "agent");
    expect(agentSteps).toHaveLength(3);
    agentSteps.forEach((step) => {
      expect((step as { providerFamily?: string }).providerFamily).toBe("anthropic");
    });
  });

  it("should have step IDs in kebab-case", () => {
    planningWorkflow.steps.forEach((step) => {
      expect(step.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/u);
    });
  });

  it("should have descriptive labels for all steps", () => {
    planningWorkflow.steps.forEach((step) => {
      expect(step.label).toBeTruthy();
    });
  });

  it("should have workflow-level timeout of 2 hours", () => {
    expect(planningWorkflow.timeoutMs).toBe(7200000);
  });

  it("should validate planning input schema accepts idea string", () => {
    const result = planningWorkflow.inputSchema.safeParse({ idea: "Build a kanban board" });
    expect(result.success).toBe(true);
  });

  it("should validate planning input schema rejects empty idea", () => {
    const result = planningWorkflow.inputSchema.safeParse({ idea: "" });
    expect(result.success).toBe(false);
  });

  it("should accept optional projectKey in input schema", () => {
    const result = planningWorkflow.inputSchema.safeParse({
      idea: "Improve monitoring",
      projectKey: "workflow"
    });
    expect(result.success).toBe(true);
  });
});
