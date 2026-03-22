import type {
  CodeReviewCheck,
  CodeReviewEvidenceArtifact,
  CodeReviewEvidenceCategory,
  CodeReviewPullRequestDetail
} from "@taxes/shared";

export interface ReviewEvidenceLink {
  readonly href: string;
  readonly label: string;
}

export interface ReviewEvidenceSection {
  readonly items: string[];
  readonly links?: readonly ReviewEvidenceLink[];
  readonly title: string;
}

export interface ReviewEvidenceSummary {
  readonly detail: string;
  readonly label: string;
  readonly status: "available" | "missing" | "partial";
}

export interface ReviewEvidencePresentation {
  readonly sections: readonly ReviewEvidenceSection[];
  readonly summaries: readonly ReviewEvidenceSummary[];
}

interface EvidenceSummaryDefinition {
  readonly category: CodeReviewEvidenceCategory;
  readonly label: string;
  readonly missingLabel: string;
}

export function buildReviewEvidencePresentation(pullRequest: CodeReviewPullRequestDetail): ReviewEvidencePresentation {
  const commands = dedupeStrings(pullRequest.narrative.validationCommands);
  const artifacts = pullRequest.auditEvidence?.artifacts ?? [];
  const summaryDefinitions: readonly EvidenceSummaryDefinition[] = [
    { category: "unit", label: "Unit tests", missingLabel: "unit-test" },
    { category: "integration", label: "Integration", missingLabel: "integration" },
    { category: "browser", label: "Browser or E2E", missingLabel: "browser or E2E" },
    { category: "visual", label: "Visual proof", missingLabel: "visual proof" }
  ];

  return {
    sections: [
      {
        items: buildArtifactItems(artifacts),
        links: buildArtifactLinks(artifacts),
        title: "Artifacts and reports"
      },
      {
        items: buildCheckItems(pullRequest.checks),
        links: buildCheckLinks(pullRequest.checks),
        title: "Reported checks"
      },
      {
        items: commands.length > 0 ? commands : ["No explicit validation commands were attached to this PR yet."],
        title: "Validation commands"
      },
      {
        items: buildAuditItems(pullRequest),
        title: "Audit lineage"
      },
      {
        items: buildMissingProofItems(pullRequest),
        title: "Missing proof to resolve"
      }
    ],
    summaries: summaryDefinitions.map((definition) =>
      buildEvidenceSummary(definition, commands, pullRequest.checks, artifacts)
    )
  };
}

function buildEvidenceSummary(
  definition: EvidenceSummaryDefinition,
  commands: readonly string[],
  checks: readonly CodeReviewCheck[],
  artifacts: readonly CodeReviewEvidenceArtifact[]
): ReviewEvidenceSummary {
  const matchingCommands = commands.filter((command) => classifyEvidenceCategory(command) === definition.category);
  const matchingChecks = checks.filter(
    (check) => classifyEvidenceCategory(`${check.workflowName ?? ""} ${check.name}`) === definition.category
  );
  const matchingArtifacts = artifacts.filter((artifact) => artifact.category === definition.category);
  const supportingSignals = [matchingCommands.length, matchingChecks.length, matchingArtifacts.length];

  if (matchingChecks.length > 0 || matchingArtifacts.length > 0) {
    return {
      detail: summarizeEvidenceCounts(matchingCommands.length, matchingChecks.length, matchingArtifacts.length),
      label: definition.label,
      status: "available"
    };
  }

  if (matchingCommands.length > 0) {
    return {
      detail: `${pluralize(matchingCommands.length, "command")} recorded, but no checks or artifacts are attached yet.`,
      label: definition.label,
      status: "partial"
    };
  }

  if (supportingSignals.every((count) => count === 0)) {
    return {
      detail: `No ${definition.missingLabel} evidence is attached yet.`,
      label: definition.label,
      status: "missing"
    };
  }

  return {
    detail: "Evidence exists, but it is not classified clearly enough yet.",
    label: definition.label,
    status: "partial"
  };
}

function summarizeEvidenceCounts(commandCount: number, checkCount: number, artifactCount: number): string {
  return [pluralize(checkCount, "check"), pluralize(commandCount, "command"), pluralize(artifactCount, "artifact")]
    .filter((entry) => !entry.startsWith("0 "))
    .join(", ");
}

function buildCheckItems(checks: readonly CodeReviewCheck[]): string[] {
  if (checks.length === 0) {
    return ["No reported checks were attached to this pull request."];
  }

  return checks.map((check) => {
    const state = (check.conclusion ?? check.status).toLowerCase();
    return `${check.workflowName ?? check.name}: ${state}`;
  });
}

function buildCheckLinks(checks: readonly CodeReviewCheck[]): readonly ReviewEvidenceLink[] {
  return checks.flatMap((check) =>
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

function buildArtifactItems(artifacts: readonly CodeReviewEvidenceArtifact[]): string[] {
  if (artifacts.length === 0) {
    return ["No screenshots, traces, reports, or coverage artifacts are attached yet."];
  }

  return artifacts.map((artifact) => {
    const details = [formatArtifactKind(artifact.kind), artifact.status, artifact.location].filter((value) => value !== undefined);
    return `${artifact.label}: ${details.join(" | ")}`;
  });
}

function buildArtifactLinks(artifacts: readonly CodeReviewEvidenceArtifact[]): readonly ReviewEvidenceLink[] {
  return artifacts.flatMap((artifact) =>
    artifact.href === undefined
      ? []
      : [
          {
            href: artifact.href,
            label: `Open ${artifact.label}`
          }
        ]
  );
}

function buildMissingProofItems(pullRequest: CodeReviewPullRequestDetail): string[] {
  const missingEvidence = pullRequest.reviewBrief?.missingEvidence ?? [];

  return missingEvidence.length > 0 ? missingEvidence : ["No unresolved proof gaps were recorded in the review brief."];
}

function classifyEvidenceCategory(value: string): CodeReviewEvidenceCategory {
  const normalized = value.toLowerCase();

  if (matchesAny(normalized, ["integration"])) {
    return "integration";
  }

  if (matchesAny(normalized, ["playwright", "browser", "e2e", "end-to-end", "cypress"])) {
    return "browser";
  }

  if (matchesAny(normalized, ["visual", "snapshot", "screenshot"])) {
    return "visual";
  }

  if (matchesAny(normalized, ["unit", "vitest", "jest"])) {
    return "unit";
  }

  return "general";
}

function formatArtifactKind(kind: CodeReviewEvidenceArtifact["kind"]): string {
  switch (kind) {
    case "coverage":
      return "coverage";
    case "html-report":
      return "html report";
    case "other":
      return "artifact";
    case "report":
      return "report";
    case "screenshot":
      return "screenshot";
    case "trace":
      return "trace";
  }
}

function pluralize(count: number, noun: string): string {
  return `${count.toString()} ${noun}${count === 1 ? "" : "s"}`;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function matchesAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}
