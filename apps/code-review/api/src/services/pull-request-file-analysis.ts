import type { CodeReviewChangedFile, CodeReviewFileChangeType, ReviewLaneId } from "@taxes/shared";

export type NonRiskReviewLaneId = Exclude<ReviewLaneId, "risks">;
export type TestSubtype = "e2e" | "integration" | "unit";

export const TEST_SUBTYPE_ORDER: readonly TestSubtype[] = ["e2e", "integration", "unit"];

export function createAreaLabel(filePath: string): string {
  const [first, second] = filePath.split("/");

  if (first === "apps" && second !== undefined) {
    return second;
  }

  if (first === ".github") {
    return "github";
  }

  return first ?? "repository";
}

export function createTags(filePath: string): string[] {
  return [...new Set([createAreaLabel(filePath), ...createTestTags(filePath), ...createSurfaceTags(filePath)])];
}

export function classifyLane(filePath: string): NonRiskReviewLaneId {
  if (isTestFile(filePath)) {
    return "tests";
  }

  if (isDocumentationFile(filePath)) {
    return "docs";
  }

  return isValidationFile(filePath) ? "validation" : "implementation";
}

export function sortFilesForLane(files: CodeReviewChangedFile[], laneId: ReviewLaneId): CodeReviewChangedFile[] {
  return [...files].sort((left, right) => {
    const priorityDifference = getLanePriority(right, laneId) - getLanePriority(left, laneId);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const churnDifference = right.additions + right.deletions - (left.additions + left.deletions);

    if (churnDifference !== 0) {
      return churnDifference;
    }

    return left.path.localeCompare(right.path);
  });
}

export function isRiskCandidate(file: CodeReviewChangedFile): boolean {
  return getRiskScore(file) > 0;
}

export function describeRisk(file: CodeReviewChangedFile): string {
  const reasons: string[] = [];

  if (file.path === "package.json") {
    reasons.push("dependency or script contract changed");
  }

  if (file.path.startsWith("prisma/")) {
    reasons.push("database contract changed");
  }

  if (file.path.startsWith(".github/workflows/")) {
    reasons.push("automation workflow changed");
  }

  if (file.path.startsWith("tools/")) {
    reasons.push("shared tooling changed");
  }

  if (file.additions + file.deletions >= 180) {
    reasons.push("large diff");
  }

  return reasons.length > 0 ? reasons.join(", ") : `+${file.additions.toString()} / -${file.deletions.toString()}`;
}

export function getTestSubtype(filePath: string): TestSubtype | null {
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

export function formatTestSubtype(subtype: TestSubtype): string {
  switch (subtype) {
    case "e2e":
      return "End-to-end";
    case "integration":
      return "Integration";
    case "unit":
      return "Unit";
  }
}

export function formatFileLabel(count: number): string {
  return count === 1 ? "file" : "files";
}

export function normalizeChangeType(changeType: string | undefined): CodeReviewFileChangeType {
  switch (changeType) {
    case undefined:
    case "added":
    case "copied":
    case "deleted":
    case "modified":
    case "renamed":
      return changeType ?? "unknown";
    default:
      return "unknown";
  }
}

function createSurfaceTags(filePath: string): string[] {
  if (isDocumentationFile(filePath)) {
    return ["docs"];
  }

  if (filePath.startsWith(".github/workflows/")) {
    return ["workflow", "tooling"];
  }

  if (filePath.startsWith("tools/")) {
    return ["tooling"];
  }

  if (filePath.startsWith("packages/shared/")) {
    return ["shared"];
  }

  if (filePath.startsWith("prisma/")) {
    return ["database"];
  }

  if (filePath === "package.json") {
    return ["dependencies"];
  }

  if (filePath.includes("/api/")) {
    return ["api"];
  }

  if (filePath.includes("/web/")) {
    return ["web"];
  }

  return [];
}

function createTestTags(filePath: string): string[] {
  const subtype = getTestSubtype(filePath);

  return subtype === null ? [] : ["test", subtype];
}

function getLanePriority(file: CodeReviewChangedFile, laneId: ReviewLaneId): number {
  switch (laneId) {
    case "risks":
      return getRiskScore(file) * 100 + file.additions + file.deletions;
    case "tests":
      return getTestSubtypeWeight(file.path) * 100 + file.additions + file.deletions;
    case "validation":
      return getValidationWeight(file.path) * 100 + file.additions + file.deletions;
    case "docs":
      return getDocumentationWeight(file.path) * 100 + file.additions + file.deletions;
    case "implementation":
      return getRiskScore(file) * 10 + file.additions + file.deletions;
    case "context":
      return file.additions + file.deletions;
  }
}

function getRiskScore(file: CodeReviewChangedFile): number {
  let score = 0;
  const churn = file.additions + file.deletions;

  if (file.path === "package.json") {
    score += 10;
  }

  if (file.path.startsWith("prisma/")) {
    score += 9;
  }

  if (file.path.startsWith(".github/workflows/")) {
    score += 8;
  }

  if (file.path.startsWith("tools/")) {
    score += 7;
  }

  if (churn >= 180) {
    score += 6;
  }

  return score;
}

function getTestSubtypeWeight(filePath: string): number {
  const subtype = getTestSubtype(filePath);

  switch (subtype) {
    case "e2e":
      return 3;
    case "integration":
      return 2;
    case "unit":
      return 1;
    case null:
      return 0;
  }
}

function getValidationWeight(filePath: string): number {
  if (filePath.startsWith(".github/workflows/")) {
    return 3;
  }

  if (filePath.includes("vitest") || filePath.includes("playwright") || filePath.includes("cypress")) {
    return 2;
  }

  if (filePath.includes("eslint") || filePath.includes("stylelint") || filePath.endsWith("tsconfig.json")) {
    return 1;
  }

  return 0;
}

function getDocumentationWeight(filePath: string): number {
  if (filePath.endsWith("README.md")) {
    return 3;
  }

  if (filePath.endsWith("AGENTS.md") || filePath.endsWith("SKILL.md")) {
    return 2;
  }

  if (filePath.startsWith("docs/")) {
    return 1;
  }

  return 0;
}

function isDocumentationFile(filePath: string): boolean {
  return (
    filePath.startsWith("docs/") ||
    filePath.endsWith("README.md") ||
    filePath.endsWith("AGENTS.md") ||
    filePath.endsWith("SKILL.md") ||
    /\.(?:md|mdx|txt)$/iu.test(filePath)
  );
}

function isTestFile(filePath: string): boolean {
  return /(?:^|\/)(?:tests?|__tests__|e2e|integration)\//iu.test(filePath) || /\.(?:spec|test)\.[cm]?[jt]sx?$/iu.test(filePath);
}

function isValidationFile(filePath: string): boolean {
  return (
    filePath === "package.json" ||
    filePath.startsWith(".github/") ||
    filePath.startsWith("tools/quality/") ||
    filePath.includes("eslint") ||
    filePath.includes("stylelint") ||
    filePath.includes("vitest") ||
    filePath.includes("playwright") ||
    filePath.includes("cypress") ||
    filePath.endsWith("tsconfig.json")
  );
}
