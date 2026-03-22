import type {
  CodeReviewAgentFinding,
  CodeReviewAgentReview,
  CodeReviewPullRequestDetail
} from "@taxes/shared";

export function buildAgentReview(detail: CodeReviewPullRequestDetail, generatedAt: string): CodeReviewAgentReview | undefined {
  const findings = [
    ...buildWorkflowFindings(detail),
    ...buildTestingFindings(detail),
    ...buildRiskFindings(detail),
    ...buildReadabilityFindings(detail)
  ];

  if (findings.length === 0) {
    return undefined;
  }

  return {
    findings,
    generatedAt,
    reviewer: "code-review-agent",
    status: "advisory",
    summary: "Advisory findings synthesized from planning linkage, validation evidence, and changed-code risk signals. Human review still decides."
  };
}

function buildWorkflowFindings(detail: CodeReviewPullRequestDetail): CodeReviewAgentFinding[] {
  if (detail.linkedPlan !== undefined) {
    return [];
  }

  return [
    {
      confidence: "high",
      evidence: ["No PLAN reference was detected in the branch name or PR body."],
      id: "workflow-missing-plan-link",
      lens: "workflow",
      rationale: "Missing plan lineage makes the review harder to ground and weakens downstream audit closure.",
      suggestedAction: "follow-up",
      summary: "Link the PR back to planning before treating the walkthrough as complete.",
      title: "Missing planning lineage"
    }
  ];
}

function buildTestingFindings(detail: CodeReviewPullRequestDetail): CodeReviewAgentFinding[] {
  const findings: CodeReviewAgentFinding[] = [];

  if (detail.narrative.validationCommands.length === 0) {
    findings.push({
      confidence: "medium",
      evidence: ["The PR narrative does not list any explicit validation commands."],
      id: "testing-missing-validation-commands",
      lens: "testing",
      rationale: "A reviewer should be able to tell which checks were intentionally run before trusting the change.",
      suggestedAction: "follow-up",
      summary: "Add explicit validation commands or evidence to the PR walkthrough.",
      title: "Validation evidence is thin"
    });
  }

  if (detail.checks.length === 0) {
    findings.push({
      confidence: "medium",
      evidence: ["No reported checks were attached to the pull request detail."],
      id: "testing-no-reported-checks",
      lens: "testing",
      rationale: "Without reported checks or attached artifacts, the reviewer has less evidence that the claimed behavior was exercised.",
      suggestedAction: "follow-up",
      summary: "Attach CI or E2E evidence before approval when the change risk warrants it.",
      title: "No reported checks attached"
    });
  }

  return findings;
}

function buildRiskFindings(detail: CodeReviewPullRequestDetail): CodeReviewAgentFinding[] {
  if ((detail.auditEvidence?.failureCount ?? 0) === 0) {
    return [];
  }

  return [
    {
      confidence: "high",
      evidence: [`Audit lineage includes ${detail.auditEvidence?.failureCount.toString() ?? "0"} recorded failures.`],
      id: "risk-audit-failures-present",
      lens: "risk",
      rationale: "A failed audited workflow is a strong signal that the change may still have unresolved issues or incomplete evidence.",
      suggestedAction: "reject",
      summary: "Resolve the failing audit evidence before the human reviewer approves in GitHub.",
      title: "Audit failures need review"
    }
  ];
}

function buildReadabilityFindings(detail: CodeReviewPullRequestDetail): CodeReviewAgentFinding[] {
  if (detail.stats.fileCount < 8) {
    return [];
  }

  return [
    {
      confidence: "low",
      evidence: [`This PR touches ${detail.stats.fileCount.toString()} files.`],
      id: "readability-large-pr-scope",
      lens: "readability",
      rationale: "Broader diffs are harder to review well and often hide cleanup or decomposition opportunities.",
      suggestedAction: "follow-up",
      summary: "Capture any refactor or decomposition work that should not stay bundled into this review.",
      title: "Review scope is broad"
    }
  ];
}
