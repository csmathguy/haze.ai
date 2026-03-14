import type { CodeReviewChangedFile, CodeReviewNarrative, CodeReviewRepository, ReviewLane, ReviewLaneId } from "@taxes/shared";

import type { GitHubPullRequestDetail } from "../adapters/github-cli.js";

export function classifyFiles(files: GitHubPullRequestDetail["files"]): CodeReviewChangedFile[] {
  return files.map((file) => ({
    additions: file.additions,
    areaLabel: createAreaLabel(file.path),
    deletions: file.deletions,
    laneId: classifyLane(file.path),
    path: normalizePath(file.path),
    tags: createTags(file.path)
  }));
}

export function buildReviewLanes(
  files: CodeReviewChangedFile[],
  narrative: CodeReviewNarrative,
  checks: GitHubPullRequestDetail["statusCheckRollup"]
): ReviewLane[] {
  const groupedFiles = groupFilesByLane(files);
  const riskFiles = files.filter(isRiskCandidate).map((file) => ({ ...file, laneId: "risks" as const }));

  return [
    createContextLane(groupedFiles.context, narrative),
    createTestsLane(groupedFiles.tests, narrative),
    createImplementationLane(groupedFiles.implementation, narrative),
    createValidationLane(groupedFiles.validation, narrative, checks),
    createRisksLane(riskFiles, narrative)
  ];
}

export function createTrustStatement(repository: CodeReviewRepository, files: CodeReviewChangedFile[]): string {
  const surfaces = summarizeTopTags(files).join(", ");

  return `Human review remains the final gate for ${repository.owner}/${repository.name}. This PR touches ${surfaces || "the repository"}, so approval should follow an explicit pass through the review lanes.`;
}

function createContextLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  return {
    evidence: createContextEvidence(narrative),
    files,
    highlights: narrative.reviewOrder.length > 0 ? narrative.reviewOrder : narrative.summaryBullets,
    id: "context",
    questions: [
      "What value does this pull request add for the repository or workflow?",
      "Which plan item or workflow thread should I keep in mind while reviewing?"
    ],
    reviewerGoal: "Orient the review around the PR summary, affected surfaces, and linked planning work before reading code.",
    summary: "Use the PR narrative and non-code artifacts to anchor the rest of the review.",
    title: "Context"
  };
}

function createTestsLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  return {
    evidence: createTestEvidence(files, narrative.validationCommands),
    files,
    highlights: files.length === 0 ? ["No test files were classified from the changed paths."] : summarizeTopTags(files),
    id: "tests",
    questions: [
      "Do the changed tests prove behavior, not just implementation detail?",
      "Are unit, integration, and end-to-end coverage split clearly enough to trust the change?"
    ],
    reviewerGoal: "Keep proof of behavior separate from production code so confidence is earned, not assumed.",
    summary: "Focus on tests and test-adjacent validation before stepping into implementation.",
    title: "Tests"
  };
}

function createImplementationLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  return {
    evidence: createImplementationEvidence(files, narrative),
    files,
    highlights: files.length === 0 ? ["No production files were detected in the changed paths."] : summarizeTopTags(files),
    id: "implementation",
    questions: [
      "Do the changed modules match the value claimed in the PR summary?",
      "Are the backend, web, shared, and tooling boundaries still coherent after the change?"
    ],
    reviewerGoal: "Walk the production diff in a stable order based on owned boundaries rather than raw GitHub file order.",
    summary: "Review the code path that delivers the value after the surrounding context and tests are clear.",
    title: "Implementation"
  };
}

function createValidationLane(
  files: CodeReviewChangedFile[],
  narrative: CodeReviewNarrative,
  checks: GitHubPullRequestDetail["statusCheckRollup"]
): ReviewLane {
  const checkEvidence = checks.map((check) => `${check.name}: ${(check.conclusion ?? check.status).toLowerCase()}`);

  return {
    evidence: checkEvidence.length > 0 ? checkEvidence : ["No status checks were reported by GitHub for this pull request."],
    files,
    highlights: narrative.validationCommands.length > 0 ? narrative.validationCommands : ["Review the reported checks and local commands before approval."],
    id: "validation",
    questions: [
      "Which validations actually ran, and what confidence do they give?",
      "Are there missing checks for the boundaries touched by this pull request?"
    ],
    reviewerGoal: "Treat automated evidence as proof inputs, not as a replacement for human judgment.",
    summary: "Surface checks, commands, and validation-oriented file changes in one place.",
    title: "Validation"
  };
}

function createRisksLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  return {
    evidence: narrative.risks,
    files,
    highlights:
      files.length === 0
        ? ["No unusually risky files were detected from the changed paths alone."]
        : files.slice(0, 4).map((file) => `${file.path} (+${file.additions.toString()} / -${file.deletions.toString()})`),
    id: "risks",
    questions: [
      "What could break even if the happy path looks good?",
      "Which changed seams deserve a second pass before approval or merge?"
    ],
    reviewerGoal: "Call out the files and workflow seams where a careful reviewer should slow down.",
    summary: "Keep failure modes and high-risk files visible before the final human decision.",
    title: "Risks"
  };
}

function groupFilesByLane(files: CodeReviewChangedFile[]): Record<Exclude<ReviewLaneId, "risks">, CodeReviewChangedFile[]> {
  return {
    context: files.filter((file) => file.laneId === "context"),
    implementation: files.filter((file) => file.laneId === "implementation"),
    tests: files.filter((file) => file.laneId === "tests"),
    validation: files.filter((file) => file.laneId === "validation")
  };
}

function createAreaLabel(filePath: string): string {
  const [first, second] = normalizePath(filePath).split("/");

  if (first === "apps" && second !== undefined) {
    return second;
  }

  return first ?? "repository";
}

function createContextEvidence(narrative: CodeReviewNarrative): string[] {
  const items = [...narrative.summaryBullets];

  for (const section of narrative.whatChangedSections) {
    items.push(`${section.title}: ${section.items.length.toString()} items`);
  }

  return items.length > 0 ? items : ["The pull request summary is the starting point for reviewer context."];
}

function createImplementationEvidence(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): string[] {
  const sectionEvidence = narrative.whatChangedSections.map((section) => `${section.title}: ${section.items.length.toString()} files`).slice(0, 3);

  if (sectionEvidence.length > 0) {
    return sectionEvidence;
  }

  return files.length === 0 ? ["No implementation files were classified for this pull request."] : files.slice(0, 3).map((file) => `${file.areaLabel}: ${file.path}`);
}

function createTestEvidence(files: CodeReviewChangedFile[], validationCommands: string[]): string[] {
  const evidence = summarizeTopTags(files.filter((file) => file.tags.includes("test")));
  const commands = validationCommands.filter((command) => /test|coverage|vitest|playwright|cypress/iu.test(command));

  return [...evidence, ...commands].slice(0, 6);
}

function summarizeTopTags(files: CodeReviewChangedFile[]): string[] {
  const counts = new Map<string, number>();

  for (const file of files) {
    for (const tag of file.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([tag, count]) => `${tag}: ${count.toString()} files`);
}

function createTags(filePath: string): string[] {
  const normalizedPath = normalizePath(filePath);

  return [...new Set([createAreaLabel(normalizedPath), ...createTestTags(normalizedPath), ...createSurfaceTags(normalizedPath)])];
}

function createSurfaceTags(filePath: string): string[] {
  if (filePath.startsWith("docs/")) {
    return ["docs"];
  }

  if (filePath.startsWith("tools/") || filePath.startsWith(".github/")) {
    return ["tooling"];
  }

  if (filePath.startsWith("packages/shared/")) {
    return ["shared"];
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
  if (!isTestFile(filePath)) {
    return [];
  }

  if (filePath.includes("/e2e") || filePath.includes("playwright") || filePath.includes("cypress")) {
    return ["test", "e2e"];
  }

  if (filePath.includes("integration")) {
    return ["test", "integration"];
  }

  return ["test", "unit"];
}

function classifyLane(filePath: string): ReviewLaneId {
  const normalizedPath = normalizePath(filePath);

  if (isTestFile(normalizedPath)) {
    return "tests";
  }

  if (normalizedPath.startsWith("docs/") || normalizedPath.endsWith("SKILL.md") || normalizedPath === "README.md") {
    return "context";
  }

  return isValidationFile(normalizedPath) ? "validation" : "implementation";
}

function isRiskCandidate(file: CodeReviewChangedFile): boolean {
  return (
    file.path === "package.json" ||
    file.path.startsWith("prisma/") ||
    file.path.startsWith("tools/") ||
    file.path.startsWith(".github/") ||
    file.additions + file.deletions >= 180
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
    filePath.endsWith("tsconfig.json")
  );
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}
