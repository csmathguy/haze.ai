import { describe, expect, test } from "vitest";
import { readStringArray, runPlannerStage } from "../src/task-planner-stage.js";

describe("task planner stage", () => {
  test("generates planning artifacts and testing intent from task input", () => {
    const result = runPlannerStage({
      taskTitle: "Planner implementation",
      taskDescription: "Build planner stage",
      acceptanceCriteria: ["Planner writes artifacts"],
      latestHumanAnswer: null,
      transitionAt: "2026-02-18T00:00:00.000Z",
      existingPlanningArtifact: {
        createdAt: "2026-02-18T00:00:00.000Z",
        goals: [],
        steps: [],
        risks: []
      },
      existingTestingPlanned: {
        gherkinScenarios: [],
        unitTestIntent: [],
        integrationTestIntent: [],
        notes: null
      }
    });

    expect(result.requiresClarification).toBe(false);
    expect(result.planningArtifact.goals.length).toBeGreaterThan(0);
    expect(result.testingPlanned.gherkinScenarios.length).toBeGreaterThan(0);
  });

  test("requires clarification when acceptance criteria or description are missing", () => {
    const result = runPlannerStage({
      taskTitle: "Ambiguous task",
      taskDescription: "",
      acceptanceCriteria: [],
      latestHumanAnswer: null,
      transitionAt: "2026-02-18T00:00:00.000Z",
      existingPlanningArtifact: {
        createdAt: "2026-02-18T00:00:00.000Z",
        goals: [],
        steps: [],
        risks: []
      },
      existingTestingPlanned: {
        gherkinScenarios: [],
        unitTestIntent: [],
        integrationTestIntent: [],
        notes: null
      }
    });

    expect(result.requiresClarification).toBe(true);
    expect(result.reasonCodes).toContain("MISSING_ACCEPTANCE_CRITERIA");
    expect(result.reasonCodes).toContain("MISSING_DESCRIPTION");
  });

  test("normalizes string arrays from unknown metadata payloads", () => {
    expect(readStringArray(["a", "  b  ", "", 1, null])).toEqual(["a", "b"]);
    expect(readStringArray("nope")).toEqual([]);
  });
});

