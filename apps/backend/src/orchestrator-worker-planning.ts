import type { TaskRecord } from "./tasks.js";

export function createPlanningAgentEvaluationKey(task: TaskRecord): string {
  const metadata = asRecord(task.metadata);
  const planningArtifact = asRecord(metadata.planningArtifact);
  const testingArtifacts = asRecord(metadata.testingArtifacts);
  const planned = asRecord(testingArtifacts.planned);
  const awaitingHuman = asRecord(metadata.awaitingHumanArtifact);
  const fingerprint = {
    title: task.title,
    description: task.description,
    acceptanceCriteria: readStringArray(metadata.acceptanceCriteria),
    planningArtifact: {
      goals: readStringArray(planningArtifact.goals),
      steps: readStringArray(planningArtifact.steps),
      risks: readStringArray(planningArtifact.risks)
    },
    testingPlanned: {
      gherkinScenarios: readStringArray(planned.gherkinScenarios),
      unitTestIntent: readStringArray(planned.unitTestIntent),
      integrationTestIntent: readStringArray(planned.integrationTestIntent)
    },
    awaitingQuestion: readString(awaitingHuman.question)
  };

  return `planning-agent:${JSON.stringify(fingerprint)}`;
}

export function isPlanningReadyForArchitectureReview(task: TaskRecord): boolean {
  if (task.status !== "planning") {
    return false;
  }
  const metadata = asRecord(task.metadata);
  if (asRecord(metadata.awaitingHumanArtifact).question) {
    return false;
  }
  const plannerDetermination = asRecord(metadata.plannerDetermination);
  const plannerDecision = readString(plannerDetermination.decision);
  if (plannerDecision !== "approved") {
    return false;
  }
  const plannerSource = readString(plannerDetermination.source);
  if (plannerSource !== "planning_agent" && plannerSource !== "human_review") {
    return false;
  }

  const planningArtifact = asRecord(metadata.planningArtifact);
  const goals = readStringArray(planningArtifact.goals);
  const steps = readStringArray(planningArtifact.steps);
  const testingArtifacts = asRecord(metadata.testingArtifacts);
  const planned = asRecord(testingArtifacts.planned);
  const gherkin = readStringArray(planned.gherkinScenarios);
  const unit = readStringArray(planned.unitTestIntent);
  const integration = readStringArray(planned.integrationTestIntent);

  return (
    goals.length > 0 &&
    steps.length > 0 &&
    gherkin.length > 0 &&
    unit.length > 0 &&
    integration.length > 0
  );
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
