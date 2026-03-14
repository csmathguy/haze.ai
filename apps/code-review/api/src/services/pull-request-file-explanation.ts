import type { CodeReviewChangedFile, CodeReviewFileChangeType, CodeReviewFileExplanation } from "@taxes/shared";

export function buildFileExplanation(file: Pick<CodeReviewChangedFile, "additions" | "areaLabel" | "changeType" | "deletions" | "laneId" | "path" | "tags">): CodeReviewFileExplanation {
  return {
    rationale: createRationale(file),
    reviewFocus: createReviewFocus(file),
    summary: createSummary(file)
  };
}

function createSummary(file: Pick<CodeReviewChangedFile, "areaLabel" | "changeType" | "laneId" | "path" | "tags">): string {
  const subtype = getTestSubtype(file.path);
  const noun = describeChangeNoun(file);
  const subtypeLabel = subtype === null ? null : `${formatTestSubtype(subtype)} `;

  switch (file.laneId) {
    case "tests":
      return `${capitalizeChangeType(file.changeType)} ${subtypeLabel ?? ""}${noun} in ${file.areaLabel}.`.trim();
    case "validation":
      return `${capitalizeChangeType(file.changeType)} validation or workflow guardrail in ${file.areaLabel}.`;
    case "docs":
      return `${capitalizeChangeType(file.changeType)} reviewer-facing documentation in ${file.areaLabel}.`;
    case "implementation":
      return `${capitalizeChangeType(file.changeType)} implementation seam in ${file.areaLabel}.`;
    case "risks":
      return `${capitalizeChangeType(file.changeType)} high-risk seam in ${file.areaLabel}.`;
    case "context":
      return `${capitalizeChangeType(file.changeType)} contextual artifact for the review path.`;
  }
}

function createRationale(file: Pick<CodeReviewChangedFile, "additions" | "changeType" | "deletions" | "laneId" | "path" | "tags">): string {
  const churn = file.additions + file.deletions;

  switch (file.laneId) {
    case "tests":
      return `This file changes the proof surface for the pull request. Review whether the assertions and fixtures validate behavior rather than only implementation detail.${churn >= 40 ? " The diff is large enough that missing edge cases deserve a second pass." : ""}`;
    case "validation":
      return "This file changes the quality gates or automation contract that determines whether the PR can be trusted before merge.";
    case "docs":
      return "This file explains or documents the change for future reviewers and contributors, so drift between docs and code should be checked explicitly.";
    case "implementation":
      return `This file carries production behavior in the ${file.tags.join(", ")} boundary, so the reviewer should confirm the code matches the claimed value and stays aligned with neighboring seams.`;
    case "risks":
      return `This file touches a risky seam${describeRiskReasonSuffix(file)}. Slow down here before relying on the rest of the walkthrough.`;
    case "context":
      return "This file helps anchor the review narrative and should be read before deeper code inspection.";
  }
}

function createReviewFocus(file: Pick<CodeReviewChangedFile, "changeType" | "laneId" | "path" | "tags">): string[] {
  const boundaryFocus = createBoundaryFocus(file.tags);

  switch (file.laneId) {
    case "tests":
      return [
        "Confirm the coverage matches the claimed behavior change.",
        `Check whether the ${getTestSubtype(file.path) ?? "test"} changes would still catch regressions if the implementation were refactored.`
      ];
    case "validation":
      return ["Verify the command or workflow still enforces the intended guardrail.", "Check whether any missing validations should have been updated alongside this file."];
    case "docs":
      return ["Confirm the documentation still matches the implemented behavior.", "Check whether a reviewer could understand the change without reopening unrelated files."];
    case "implementation":
      return [`Inspect the ${boundaryFocus} seam first.`, `Confirm the ${file.changeType} path still respects repository boundaries and shared contracts.`];
    case "risks":
      return ["Review the invariants or workflow assumptions around this file before reading the rest of the diff.", "Check for follow-on files that depend on this seam but may not be obvious from the lane summary."];
    case "context":
      return ["Use this file to orient the rest of the review order.", "Confirm the narrative here still matches the changed code and tests."];
  }
}

function getTestSubtype(filePath: string): "e2e" | "integration" | "unit" | null {
  if (!isTestFile(filePath)) {
    return null;
  }

  if (filePath.includes("/e2e") || filePath.includes("playwright") || filePath.includes("cypress")) {
    return "e2e";
  }

  if (filePath.includes("integration")) {
    return "integration";
  }

  return "unit";
}

function formatTestSubtype(subtype: "e2e" | "integration" | "unit"): string {
  switch (subtype) {
    case "e2e":
      return "End-to-end";
    case "integration":
      return "Integration";
    case "unit":
      return "Unit";
  }
}

function describeChangeNoun(file: Pick<CodeReviewChangedFile, "path" | "tags">): string {
  if (file.tags.includes("test")) {
    return "coverage";
  }

  if (file.tags.includes("workflow")) {
    return "workflow";
  }

  if (file.tags.includes("docs")) {
    return "documentation";
  }

  return file.path.split("/").at(-1) ?? "file";
}

function capitalizeChangeType(changeType: CodeReviewFileChangeType): string {
  return changeType.charAt(0).toUpperCase() + changeType.slice(1);
}

function createBoundaryFocus(tags: readonly string[]): string {
  if (tags.includes("shared")) {
    return "shared contract";
  }

  if (tags.includes("api")) {
    return "API";
  }

  if (tags.includes("web")) {
    return "web";
  }

  if (tags.includes("database")) {
    return "database";
  }

  return "module";
}

function describeRiskReasonSuffix(file: Pick<CodeReviewChangedFile, "additions" | "deletions" | "path">): string {
  if (file.path === "package.json") {
    return " because dependency or script wiring changed";
  }

  if (file.path.startsWith("prisma/")) {
    return " because the database contract changed";
  }

  if (file.path.startsWith(".github/workflows/")) {
    return " because automation behavior changed";
  }

  if (file.path.startsWith("tools/")) {
    return " because shared tooling changed";
  }

  if (file.additions + file.deletions >= 180) {
    return " because the diff is unusually large";
  }

  return "";
}

function isTestFile(filePath: string): boolean {
  return /(?:^|\/)(?:tests?|__tests__|e2e|integration)\//iu.test(filePath) || /\.(?:spec|test)\.[cm]?[jt]sx?$/iu.test(filePath);
}
