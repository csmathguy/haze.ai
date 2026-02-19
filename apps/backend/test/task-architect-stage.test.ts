import { describe, expect, test } from "vitest";
import { runArchitectStage } from "../src/task-architect-stage.js";

describe("task architect stage", () => {
  test("returns approved when planning/testing artifacts satisfy policy checks", () => {
    const result = runArchitectStage({
      acceptanceCriteria: ["Architect stage emits review artifacts"],
      latestHumanAnswer: null,
      transitionAt: "2026-02-19T00:00:00.000Z",
      planningArtifact: {
        createdAt: "2026-02-19T00:00:00.000Z",
        goals: ["Define module boundaries"],
        steps: ["Implement stage adapter", "Add integration tests"],
        risks: ["Potential parser mismatch risk"]
      },
      testingPlanned: {
        gherkinScenarios: ["Given architect stage..."],
        unitTestIntent: ["Validate decision derivation"],
        integrationTestIntent: ["Validate service transition handling"],
        notes: "planned"
      }
    });

    expect(result.reviewArtifact.decision).toBe("approved");
    expect(result.reviewArtifact.findings).toEqual([]);
    expect(result.requiresRemediation).toBe(false);
    expect(result.requiresHumanDecision).toBe(false);
  });

  test("returns changes_requested when major findings exist", () => {
    const result = runArchitectStage({
      acceptanceCriteria: [],
      latestHumanAnswer: null,
      transitionAt: "2026-02-19T00:00:00.000Z",
      planningArtifact: {
        createdAt: "2026-02-19T00:00:00.000Z",
        goals: [],
        steps: [],
        risks: []
      },
      testingPlanned: {
        gherkinScenarios: [],
        unitTestIntent: [],
        integrationTestIntent: [],
        notes: null
      }
    });

    expect(result.reviewArtifact.decision).toBe("changes_requested");
    expect(result.reviewArtifact.findings.length).toBeGreaterThan(0);
    expect(result.requiresRemediation).toBe(true);
    expect(result.requiresHumanDecision).toBe(false);
  });

  test("returns blocked_needs_human_decision when policy exception is present without approval", () => {
    const result = runArchitectStage({
      acceptanceCriteria: ["Guardrails stay enforced"],
      latestHumanAnswer: null,
      transitionAt: "2026-02-19T00:00:00.000Z",
      planningArtifact: {
        createdAt: "2026-02-19T00:00:00.000Z",
        goals: ["Keep architecture policy compliant"],
        steps: ["Run architect stage checks"],
        risks: ["Policy exception required for deployment shortcut"]
      },
      testingPlanned: {
        gherkinScenarios: ["Given policy exception risk..."],
        unitTestIntent: ["Validate blocking behavior"],
        integrationTestIntent: ["Validate awaiting_human redirect"],
        notes: null
      }
    });

    expect(result.reviewArtifact.decision).toBe("blocked_needs_human_decision");
    expect(result.reasonCodes).toContain("ARCHITECT_POLICY_EXCEPTION_REQUIRES_HUMAN_DECISION");
    expect(result.requiresHumanDecision).toBe(true);
  });
});
