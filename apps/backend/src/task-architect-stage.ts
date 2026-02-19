import type {
  PlannerArtifactState,
  PlannerTestingPlannedState
} from "./task-planner-stage.js";

export type ArchitectDecision =
  | "approved"
  | "changes_requested"
  | "blocked_needs_human_decision";

export type ArchitectFindingSeverity = "critical" | "major" | "minor";
export type ArchitectFindingCategory = "architecture" | "safety" | "testing" | "workflow";
export type ArchitectFindingStatus = "open" | "resolved";

export interface ArchitectFinding {
  id: string;
  severity: ArchitectFindingSeverity;
  category: ArchitectFindingCategory;
  summary: string;
  evidenceRefs: string[];
  requiredRemediation: string;
  status: ArchitectFindingStatus;
}

export interface ArchitectReviewArtifact {
  decision: ArchitectDecision;
  createdAt: string;
  findings: ArchitectFinding[];
  summary: string[];
  nextActions: string[];
}

export interface ArchitectExecutionInput {
  acceptanceCriteria: string[];
  latestHumanAnswer: string | null;
  transitionAt: string;
  planningArtifact: PlannerArtifactState;
  testingPlanned: PlannerTestingPlannedState;
}

export interface ArchitectExecutionOutput {
  reviewArtifact: ArchitectReviewArtifact;
  reasonCodes: string[];
  requiresRemediation: boolean;
  requiresHumanDecision: boolean;
}

export function runArchitectStage(input: ArchitectExecutionInput): ArchitectExecutionOutput {
  const findings: ArchitectFinding[] = [];
  const reasonCodes: string[] = [];

  if (input.planningArtifact.goals.length === 0) {
    findings.push(
      createFinding(
        "architecture",
        "major",
        "Planning goals are missing.",
        ["metadata.planningArtifact.goals"],
        "Define explicit implementation goals mapped to acceptance criteria.",
        "ARCHITECT_MISSING_PLANNING_GOALS"
      )
    );
    reasonCodes.push("ARCHITECT_MISSING_PLANNING_GOALS");
  }

  if (input.planningArtifact.steps.length === 0) {
    findings.push(
      createFinding(
        "workflow",
        "major",
        "Implementation steps are missing from planning artifact.",
        ["metadata.planningArtifact.steps"],
        "Add ordered implementation steps with module boundaries and verification checkpoints.",
        "ARCHITECT_MISSING_PLANNING_STEPS"
      )
    );
    reasonCodes.push("ARCHITECT_MISSING_PLANNING_STEPS");
  }

  if (input.acceptanceCriteria.length === 0) {
    findings.push(
      createFinding(
        "architecture",
        "major",
        "Acceptance criteria are missing for architecture review.",
        ["metadata.acceptanceCriteria"],
        "Define acceptance criteria before architecture sign-off.",
        "ARCHITECT_MISSING_ACCEPTANCE_CRITERIA"
      )
    );
    reasonCodes.push("ARCHITECT_MISSING_ACCEPTANCE_CRITERIA");
  }

  if (input.testingPlanned.unitTestIntent.length === 0) {
    findings.push(
      createFinding(
        "testing",
        "major",
        "Unit test intent is missing from planned testing artifacts.",
        ["metadata.testingArtifacts.planned.unitTestIntent"],
        "Add unit test intent for all architect-stage logic branches.",
        "ARCHITECT_MISSING_UNIT_TEST_INTENT"
      )
    );
    reasonCodes.push("ARCHITECT_MISSING_UNIT_TEST_INTENT");
  }

  if (input.testingPlanned.integrationTestIntent.length === 0) {
    findings.push(
      createFinding(
        "testing",
        "major",
        "Integration test intent is missing from planned testing artifacts.",
        ["metadata.testingArtifacts.planned.integrationTestIntent"],
        "Add integration test intent for orchestration stage boundaries.",
        "ARCHITECT_MISSING_INTEGRATION_TEST_INTENT"
      )
    );
    reasonCodes.push("ARCHITECT_MISSING_INTEGRATION_TEST_INTENT");
  }

  const requiresPolicyException = input.planningArtifact.risks.some((risk) =>
    /policy exception|risk acceptance|waive/i.test(risk)
  );
  const hasHumanApproval = input.latestHumanAnswer
    ? /(approve|approved|accept|accepted|waive|exception)/i.test(input.latestHumanAnswer)
    : false;

  if (requiresPolicyException && !hasHumanApproval) {
    findings.push(
      createFinding(
        "safety",
        "critical",
        "Policy exception requires explicit human decision before continuing.",
        ["metadata.planningArtifact.risks"],
        "Route to awaiting_human with explicit options and recommended default.",
        "ARCHITECT_POLICY_EXCEPTION_REQUIRES_HUMAN_DECISION"
      )
    );
    reasonCodes.push("ARCHITECT_POLICY_EXCEPTION_REQUIRES_HUMAN_DECISION");
  }

  const decision = decide(findings);
  const summary = buildSummary(decision, findings.length);
  const nextActions = findings
    .filter((finding) => finding.status === "open")
    .map((finding) => `[${finding.id}] ${finding.requiredRemediation}`);

  return {
    reviewArtifact: {
      decision,
      createdAt: input.transitionAt,
      findings,
      summary,
      nextActions
    },
    reasonCodes,
    requiresRemediation: decision === "changes_requested",
    requiresHumanDecision: decision === "blocked_needs_human_decision"
  };
}

function createFinding(
  category: ArchitectFindingCategory,
  severity: ArchitectFindingSeverity,
  summary: string,
  evidenceRefs: string[],
  requiredRemediation: string,
  reasonCode: string
): ArchitectFinding {
  return {
    id: reasonCode,
    category,
    severity,
    summary,
    evidenceRefs,
    requiredRemediation,
    status: "open"
  };
}

function decide(findings: ArchitectFinding[]): ArchitectDecision {
  if (findings.some((finding) => finding.severity === "critical")) {
    return "blocked_needs_human_decision";
  }
  if (findings.some((finding) => finding.severity === "major")) {
    return "changes_requested";
  }
  return "approved";
}

function buildSummary(decision: ArchitectDecision, findingCount: number): string[] {
  switch (decision) {
    case "approved":
      return [
        "Architect review approved planning artifacts.",
        "No blocking architecture or testing policy findings were detected."
      ];
    case "changes_requested":
      return [
        `Architect review found ${findingCount} unresolved major findings.`,
        "Complete required remediation and rerun architect stage."
      ];
    case "blocked_needs_human_decision":
      return [
        "Architect review detected a policy-exception decision requiring human input.",
        "Task is blocked pending explicit operator decision."
      ];
  }
}
