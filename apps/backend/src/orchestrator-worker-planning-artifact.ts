import type { PlanningAgentDecision } from "./planning-agent-runner.js";

interface BasePlanningAgentRunArtifact {
  runId: string;
  sessionId: string | null;
  taskId: string;
  at: string;
}

export function buildCompletedPlanningAgentArtifact(
  base: BasePlanningAgentRunArtifact,
  decision: PlanningAgentDecision
): Record<string, unknown> {
  return {
    lastRun: {
      ...base,
      status: "completed",
      decision: decision.decision,
      reasonCodes: decision.reasonCodes,
      trace: decision.trace ?? null
    }
  };
}

export function buildFailedPlanningAgentArtifact(
  base: BasePlanningAgentRunArtifact,
  details: {
    errorCode: string;
    error: string;
    details: Record<string, unknown> | null;
  }
): Record<string, unknown> {
  return {
    lastRun: {
      ...base,
      status: "failed",
      errorCode: details.errorCode,
      error: details.error,
      details: details.details
    }
  };
}
