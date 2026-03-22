import type { CodeReviewPullRequestDetail } from "@taxes/shared";

export interface ReviewEvidenceLink {
  readonly href: string;
  readonly label: string;
}

export interface ReviewEvidenceSection {
  readonly items: string[];
  readonly links?: readonly ReviewEvidenceLink[];
  readonly title: string;
}

export interface ReviewEvidencePresentation {
  readonly sections: readonly ReviewEvidenceSection[];
}

export function buildReviewEvidencePresentation(pullRequest: CodeReviewPullRequestDetail): ReviewEvidencePresentation {
  return {
    sections: [
      {
        items: buildValidationCommandItems(pullRequest),
        title: "Validation commands"
      },
      {
        items: buildCheckItems(pullRequest),
        links: buildCheckLinks(pullRequest),
        title: "Reported checks"
      },
      {
        items: buildAuditItems(pullRequest),
        title: "Audit lineage"
      },
      {
        items: buildArtifactItems(pullRequest),
        title: "Visual and artifact evidence"
      }
    ]
  };
}

function buildValidationCommandItems(pullRequest: CodeReviewPullRequestDetail): string[] {
  const commands = dedupeStrings(pullRequest.narrative.validationCommands);

  return commands.length > 0 ? commands : ["No explicit validation commands were attached to this PR yet."];
}

function buildCheckItems(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.checks.length === 0) {
    return ["No reported checks were attached to this pull request."];
  }

  return pullRequest.checks.map((check) => {
    const state = (check.conclusion ?? check.status).toLowerCase();
    return `${check.workflowName ?? check.name}: ${state}`;
  });
}

function buildCheckLinks(pullRequest: CodeReviewPullRequestDetail): readonly ReviewEvidenceLink[] {
  return pullRequest.checks.flatMap((check) =>
    check.detailsUrl === undefined
      ? []
      : [
          {
            href: check.detailsUrl,
            label: `Open ${check.workflowName ?? check.name}`
          }
        ]
  );
}

function buildAuditItems(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.auditEvidence === undefined) {
    return pullRequest.linkedPlan === undefined
      ? ["Link this PR to a planning item before expecting audit lineage in the walkthrough."]
      : [`No audit lineage is materialized yet for ${pullRequest.linkedPlan.workItemId}.`];
  }

  return [
    `${pullRequest.auditEvidence.runCount.toString()} linked audit runs`,
    `${pullRequest.auditEvidence.handoffCount.toString()} recorded handoffs`,
    `${pullRequest.auditEvidence.failureCount.toString()} recorded audit failures`,
    `Active agents: ${pullRequest.auditEvidence.activeAgents.join(", ") || "none recorded"}`,
    ...(pullRequest.auditEvidence.recentRuns[0] === undefined
      ? []
      : [
          `Latest run: ${pullRequest.auditEvidence.recentRuns[0].workflow} (${pullRequest.auditEvidence.recentRuns[0].status})`
        ])
  ];
}

function buildArtifactItems(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.auditEvidence === undefined || pullRequest.auditEvidence.artifactCount === 0) {
    return [
      "No stored screenshots or traces are attached yet.",
      "E2E review should eventually surface visual artifacts here so a human can confirm the behavior."
    ];
  }

  return [
    `${pullRequest.auditEvidence.artifactCount.toString()} workflow artifacts are available for reviewer follow-up.`,
    "Use those artifacts to confirm screenshots, traces, or other captured evidence before approving."
  ];
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}
