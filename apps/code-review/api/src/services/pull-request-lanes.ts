import type { CodeReviewChangedFile, CodeReviewNarrative, CodeReviewRepository, ReviewLane } from "@taxes/shared";

import type { GitHubPullRequestDetail } from "../adapters/github-cli.js";
import {
  TEST_SUBTYPE_ORDER,
  classifyLane,
  createAreaLabel,
  createTags,
  describeRisk,
  formatFileLabel,
  formatTestSubtype,
  getTestSubtype,
  isRiskCandidate,
  sortFilesForLane,
  type NonRiskReviewLaneId,
  type TestSubtype
} from "./pull-request-file-analysis.js";

export function classifyFiles(files: GitHubPullRequestDetail["files"]): CodeReviewChangedFile[] {
  return files.map((file) => {
    const normalizedPath = normalizePath(file.path);

    return {
      additions: file.additions,
      areaLabel: createAreaLabel(normalizedPath),
      deletions: file.deletions,
      laneId: classifyLane(normalizedPath),
      path: normalizedPath,
      tags: createTags(normalizedPath)
    };
  });
}

export function buildReviewLanes(
  files: CodeReviewChangedFile[],
  narrative: CodeReviewNarrative,
  checks: GitHubPullRequestDetail["statusCheckRollup"]
): ReviewLane[] {
  const groupedFiles = groupFilesByLane(files);
  const riskFiles = sortFilesForLane(
    files.filter(isRiskCandidate).map((file) => ({ ...file, laneId: "risks" as const })),
    "risks"
  );

  return [
    createContextLane(groupedFiles.context, narrative),
    createRisksLane(riskFiles, narrative),
    createTestsLane(groupedFiles.tests, narrative),
    createImplementationLane(groupedFiles.implementation, narrative),
    createValidationLane(groupedFiles.validation, narrative, checks),
    createDocsLane(groupedFiles.docs, narrative)
  ];
}

export function createTrustStatement(repository: CodeReviewRepository, files: CodeReviewChangedFile[]): string {
  const surfaces = summarizeTopTags(files).join(", ");

  return `Human review remains the final gate for ${repository.owner}/${repository.name}. This PR touches ${surfaces || "the repository"}, so approval should follow an explicit pass through the review lanes.`;
}

function createContextLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  return {
    evidence: createContextEvidence(narrative),
    files: sortFilesForLane(files, "context"),
    highlights: narrative.reviewOrder.length > 0 ? narrative.reviewOrder : narrative.summaryBullets,
    id: "context",
    questions: [
      "What value does this pull request add for the repository or workflow?",
      "Which plan item or workflow thread should I keep in mind while reviewing?"
    ],
    reviewerGoal: "Orient the review around the PR summary, affected surfaces, and linked planning work before reading code.",
    summary: "Start with the claimed value, linked plan context, and the intended review path.",
    title: "Context"
  };
}

function createTestsLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  const sortedFiles = sortFilesForLane(files, "tests");
  const subtypeHighlights = summarizeTestSubtypeCounts(sortedFiles);

  return {
    evidence: createTestEvidence(sortedFiles, narrative.validationCommands),
    files: sortedFiles,
    highlights: subtypeHighlights.length > 0 ? subtypeHighlights : ["No test files were classified from the changed paths."],
    id: "tests",
    questions: [
      "Do the changed tests prove behavior, not just implementation detail?",
      "Are unit, integration, and end-to-end coverage separated clearly enough to trust the change?"
    ],
    reviewerGoal: "Keep proof of behavior separate from production code so confidence is earned, not assumed.",
    summary: "Review test coverage by subtype before stepping into implementation.",
    title: "Tests"
  };
}

function createImplementationLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  const sortedFiles = sortFilesForLane(files, "implementation");

  return {
    evidence: createImplementationEvidence(sortedFiles, narrative),
    files: sortedFiles,
    highlights: sortedFiles.length === 0 ? ["No production files were detected in the changed paths."] : summarizeTopTags(sortedFiles),
    id: "implementation",
    questions: [
      "Do the changed modules match the value claimed in the PR summary?",
      "Are the backend, web, shared, and tooling boundaries still coherent after the change?"
    ],
    reviewerGoal: "Walk the production diff in a stable order based on owned boundaries rather than raw GitHub file order.",
    summary: "Review the executable code after context, risk framing, and test coverage are clear.",
    title: "Implementation"
  };
}

function createValidationLane(
  files: CodeReviewChangedFile[],
  narrative: CodeReviewNarrative,
  checks: GitHubPullRequestDetail["statusCheckRollup"]
): ReviewLane {
  const sortedFiles = sortFilesForLane(files, "validation");
  const checkEvidence = checks.map((check) => `${check.name}: ${(check.conclusion ?? check.status).toLowerCase()}`);

  return {
    evidence: checkEvidence.length > 0 ? checkEvidence : ["No status checks were reported by GitHub for this pull request."],
    files: sortedFiles,
    highlights: narrative.validationCommands.length > 0 ? narrative.validationCommands : ["Review the reported checks and local commands before approval."],
    id: "validation",
    questions: [
      "Which validations actually ran, and what confidence do they give?",
      "Are there missing checks for the boundaries touched by this pull request?"
    ],
    reviewerGoal: "Treat automated evidence as proof inputs, not as a replacement for human judgment.",
    summary: "Surface checks, validation commands, and quality-tool changes in one place.",
    title: "Validation"
  };
}

function createDocsLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  const sortedFiles = sortFilesForLane(files, "docs");

  return {
    evidence: createDocumentationEvidence(sortedFiles, narrative),
    files: sortedFiles,
    highlights: sortedFiles.length === 0 ? ["No documentation or reviewer-guidance files changed in this pull request."] : summarizeDocumentationHighlights(sortedFiles),
    id: "docs",
    questions: [
      "Do the docs, instructions, or release-note style artifacts still match the code path being reviewed?",
      "Will the next human understand the change without reopening the entire diff?"
    ],
    reviewerGoal: "Keep reviewer-facing guidance and long-lived docs visible as a separate review concern.",
    summary: "Inspect docs, instructions, and release-note style changes apart from executable code.",
    title: "Docs"
  };
}

function createRisksLane(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): ReviewLane {
  return {
    evidence: narrative.risks.length > 0 ? narrative.risks : ["No explicit risks were listed in the pull request body."],
    files,
    highlights:
      files.length === 0
        ? ["No unusually risky files were detected from the changed paths alone."]
        : files.slice(0, 4).map((file) => `${file.path}: ${describeRisk(file)}`),
    id: "risks",
    questions: [
      "What could break even if the happy path looks good?",
      "Which changed seams deserve a second pass before approval or merge?"
    ],
    reviewerGoal: "Call out the files and workflow seams where a careful reviewer should slow down first.",
    summary: "Escalate the risky seams early so the review order is deliberate instead of flat.",
    title: "Risks"
  };
}

function groupFilesByLane(files: CodeReviewChangedFile[]): Record<NonRiskReviewLaneId, CodeReviewChangedFile[]> {
  return {
    context: sortFilesForLane(
      files.filter((file) => file.laneId === "context"),
      "context"
    ),
    docs: sortFilesForLane(
      files.filter((file) => file.laneId === "docs"),
      "docs"
    ),
    implementation: sortFilesForLane(
      files.filter((file) => file.laneId === "implementation"),
      "implementation"
    ),
    tests: sortFilesForLane(
      files.filter((file) => file.laneId === "tests"),
      "tests"
    ),
    validation: sortFilesForLane(
      files.filter((file) => file.laneId === "validation"),
      "validation"
    )
  };
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

function createDocumentationEvidence(files: CodeReviewChangedFile[], narrative: CodeReviewNarrative): string[] {
  if (files.length > 0) {
    return files.slice(0, 4).map((file) => file.path);
  }

  const narrativeSections = narrative.whatChangedSections.filter((section) => /doc|guide|instruction|readme|release/iu.test(section.title));

  if (narrativeSections.length > 0) {
    return narrativeSections.map((section) => `${section.title}: ${section.items.length.toString()} items`);
  }

  return ["No dedicated documentation evidence was detected from the changed files."];
}

function createTestEvidence(files: CodeReviewChangedFile[], validationCommands: string[]): string[] {
  const evidence = summarizeTestSubtypeCounts(files);
  const commands = validationCommands.filter((command) => /test|coverage|vitest|playwright|cypress/iu.test(command));

  return [...evidence, ...commands].slice(0, 6);
}

function summarizeTestSubtypeCounts(files: CodeReviewChangedFile[]): string[] {
  const counts = new Map<TestSubtype, number>();

  for (const subtype of TEST_SUBTYPE_ORDER) {
    counts.set(subtype, 0);
  }

  for (const file of files) {
    const subtype = getTestSubtype(file.path);

    if (subtype !== null) {
      counts.set(subtype, (counts.get(subtype) ?? 0) + 1);
    }
  }

  return TEST_SUBTYPE_ORDER.flatMap((subtype) => {
    const count = counts.get(subtype) ?? 0;

    return count === 0 ? [] : [`${formatTestSubtype(subtype)}: ${count.toString()} ${formatFileLabel(count)}`];
  });
}

function summarizeDocumentationHighlights(files: CodeReviewChangedFile[]): string[] {
  return files.slice(0, 4).map((file) => `${file.areaLabel}: ${file.path}`);
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
    .map(([tag, count]) => `${tag}: ${count.toString()} ${formatFileLabel(count)}`);
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}
