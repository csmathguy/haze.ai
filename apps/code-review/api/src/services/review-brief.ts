import type { CodeReviewPullRequestDetail, CodeReviewReviewBrief } from "@taxes/shared";

export function buildReviewBrief(detail: CodeReviewPullRequestDetail, generatedAt: string): CodeReviewReviewBrief {
  return {
    followUpCandidates: buildFollowUpCandidates(detail),
    generatedAt,
    inspectFirst: buildInspectFirst(detail),
    missingEvidence: buildMissingEvidence(detail),
    sourceHeadSha: detail.headSha,
    startHere: buildStartHere(detail),
    summary: buildSummary(detail),
    whatThisPrDoes: buildWhatThisPrDoes(detail)
  };
}

function buildSummary(detail: CodeReviewPullRequestDetail): string {
  if (detail.planningWorkItem !== undefined) {
    return `${detail.planningWorkItem.workItemId} drives this PR: ${detail.planningWorkItem.title}`;
  }

  return detail.narrative.valueSummary;
}

function buildWhatThisPrDoes(detail: CodeReviewPullRequestDetail): string[] {
  const summaryBullets = detail.narrative.summaryBullets.slice(0, 3);

  if (summaryBullets.length > 0) {
    return summaryBullets;
  }

  const changedSections = detail.narrative.whatChangedSections
    .slice(0, 3)
    .map((section) => `${section.title}: ${section.items.join(", ")}`);

  return changedSections.length > 0 ? changedSections : [detail.title];
}

function buildStartHere(detail: CodeReviewPullRequestDetail): string[] {
  const items = [
    detail.linkedPlan === undefined
      ? "Anchor this review to a planning item before trusting the walkthrough."
      : `Start with ${detail.linkedPlan.workItemId}: confirm the work-item goal and expected outcome before opening the diff.`,
    detail.narrative.reviewOrder[0] === undefined
      ? "Begin with the context lane before opening raw diffs."
      : `Follow the guided review order starting with ${detail.narrative.reviewOrder[0]}.`
  ];

  if (detail.agentReview?.findings[0] !== undefined) {
    items.push(`Keep the advisory findings separate from approval. The strongest current signal is: ${detail.agentReview.findings[0].title}.`);
  }

  return items;
}

function buildInspectFirst(detail: CodeReviewPullRequestDetail): string[] {
  const riskHighlights = detail.lanes.find((lane) => lane.id === "risks")?.highlights.filter(notEmpty).slice(0, 2) ?? [];
  const implementationFiles =
    detail.lanes
      .find((lane) => lane.id === "implementation")
      ?.files.slice(0, 2)
      .map((file) => `${file.path}: ${file.explanation.summary}`) ?? [];

  return [...riskHighlights, ...implementationFiles].slice(0, 4).filter(notEmpty);
}

function buildMissingEvidence(detail: CodeReviewPullRequestDetail): string[] {
  const items = [...(detail.evidenceWarnings ?? [])];

  if (detail.narrative.validationCommands.length === 0) {
    items.push("No explicit validation commands are attached to the PR narrative.");
  }

  if (detail.checks.length === 0) {
    items.push("No reported checks are attached to this PR detail yet.");
  }

  if (detail.lanes.find((lane) => lane.id === "tests")?.files.length === 0) {
    items.push("No changed test files were classified for this PR.");
  }

  return dedupe(items).slice(0, 5);
}

function buildFollowUpCandidates(detail: CodeReviewPullRequestDetail): string[] {
  const fromAgent = detail.agentReview?.findings
    .filter((finding) => finding.suggestedAction === "follow-up")
    .map((finding) => finding.summary) ?? [];
  const fromScope =
    detail.stats.fileCount >= 8 ? ["Consider whether this PR should be decomposed or whether refactor follow-up work should be created."] : [];

  return dedupe([...fromAgent, ...fromScope]).slice(0, 5);
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(notEmpty))];
}

function notEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
