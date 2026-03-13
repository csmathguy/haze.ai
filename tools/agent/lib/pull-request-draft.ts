export interface PullRequestArea {
  details?: string[];
  files: string[];
  title: string;
}

export interface PullRequestDraft {
  areas: PullRequestArea[];
  markdown: string;
  reviewFocus: string[];
  reviewOrder: string[];
  risks: string[];
}

interface DraftAreaDefinition {
  focus?: string;
  id: "api" | "database" | "docs" | "shared" | "tooling" | "web";
  matches: (file: string) => boolean;
  risk?: string;
  title: string;
}

const AREA_DEFINITIONS: DraftAreaDefinition[] = [
  {
    focus: "Check schema shape, migration intent, data compatibility, and whether local apply steps need special care.",
    id: "database",
    matches: (file) => file.startsWith("prisma/") || file === "prisma.config.ts",
    risk: "Schema or migration changes can affect local SQLite data compatibility and rollout steps.",
    title: "Database and persistence"
  },
  {
    focus: "Review shared type or schema changes first because they can alter both backend and frontend assumptions.",
    id: "shared",
    matches: (file) => file.startsWith("packages/shared/"),
    risk: "Shared contract changes can break both API and web consumers if the update is only partially applied.",
    title: "Shared contracts"
  },
  {
    focus: "Inspect backend routes, services, validation, and privacy-sensitive file or persistence handling.",
    id: "api",
    matches: isApiAppFile,
    title: "API and backend workflow"
  },
  {
    focus: "Inspect the user-facing flow, API assumptions, and whether the UI still reflects the backend contract accurately.",
    id: "web",
    matches: isWebAppFile,
    title: "Web UI and client workflow"
  },
  {
    focus: "Review local workflow, CI, scripts, and agent automation because these changes can affect every future change.",
    id: "tooling",
    matches: (file) =>
      file.startsWith("tools/") ||
      file.startsWith(".github/") ||
      isRepositoryConfig(file),
    risk: "Tooling or CI changes can slow or block local development, validation, or agent workflows.",
    title: "Tooling and automation"
  },
  {
    focus: "Confirm the written process still matches the actual repository workflow and reviewer expectations.",
    id: "docs",
    matches: (file) => isDocumentationFile(file),
    title: "Documentation and contributor workflow"
  }
];

export function buildPullRequestDraft(files: string[]): PullRequestDraft {
  const normalizedFiles = normalizeFiles(files);
  const areas = collectAreas(normalizedFiles);
  const reviewFocus = buildReviewFocus(areas);
  const risks = buildRisks(areas);
  const reviewOrder = areas.map((area) => area.title);

  return {
    areas,
    markdown: renderPullRequestDraft({
      areas,
      reviewFocus,
      reviewOrder,
      risks
    }),
    reviewFocus,
    reviewOrder,
    risks
  };
}

function normalizeFiles(files: string[]): string[] {
  return [...new Set(files.map((file) => file.replaceAll("\\", "/").trim()).filter((file) => file.length > 0))];
}

function collectAreas(files: string[]): PullRequestArea[] {
  return AREA_DEFINITIONS.flatMap((definition) => {
    const matchedFiles = files.filter((file) => definition.matches(file));

    if (matchedFiles.length === 0) {
      return [];
    }

    return [
      {
        files: matchedFiles,
        title: definition.title
      }
    ];
  });
}

function buildReviewFocus(areas: PullRequestArea[]): string[] {
  const focusEntries = AREA_DEFINITIONS.flatMap((definition) => getAreaFocus(areas, definition));

  if (hasArea(areas, "API and backend workflow") && hasArea(areas, "Web UI and client workflow")) {
    const toolingIndex = focusEntries.findIndex((entry) => entry.startsWith("Review local workflow, CI, scripts"));
    const endToEndFocus =
      "Review the backend and frontend changes together so request, response, and workflow assumptions stay in sync.";

    if (toolingIndex === -1) {
      focusEntries.push(endToEndFocus);
    } else {
      focusEntries.splice(toolingIndex, 0, endToEndFocus);
    }
  }

  return focusEntries;
}

function buildRisks(areas: PullRequestArea[]): string[] {
  const risks = AREA_DEFINITIONS.flatMap((definition) => getAreaRisk(areas, definition));

  if (hasArea(areas, "API and backend workflow") && hasArea(areas, "Web UI and client workflow")) {
    const toolingIndex = risks.findIndex((entry) => entry.startsWith("Tooling or CI changes"));
    const endToEndRisk =
      "Coordinated backend and frontend changes need an end-to-end review to confirm the workflow still matches across the API boundary.";

    if (toolingIndex === -1) {
      risks.push(endToEndRisk);
    } else {
      risks.splice(toolingIndex, 0, endToEndRisk);
    }
  }

  if (risks.length === 0) {
    return ["Low behavioral risk from changed code paths was detected from file paths alone."];
  }

  return risks;
}

function getAreaFocus(areas: PullRequestArea[], definition: DraftAreaDefinition): string[] {
  if (!areas.some((area) => area.title === definition.title) || definition.focus === undefined) {
    return [];
  }

  return [definition.focus];
}

function getAreaRisk(areas: PullRequestArea[], definition: DraftAreaDefinition): string[] {
  if (!areas.some((area) => area.title === definition.title) || definition.risk === undefined) {
    return [];
  }

  return [definition.risk];
}

function renderPullRequestDraft(draft: Omit<PullRequestDraft, "markdown">): string {
  const affectedAreas = draft.areas.map(renderArea).join("\n");
  const reviewOrder = draft.reviewOrder.map((item, index) => `${String(index + 1)}. ${item}`).join("\n");
  const reviewFocus = draft.reviewFocus.map((item) => `- ${item}`).join("\n");
  const risks = draft.risks.map((item) => `- ${item}`).join("\n");

  return [
    "## Summary",
    "",
    "- TODO: Describe the behavioral change in one or two sentences.",
    "- TODO: Explain the user, reviewer, or workflow value of the change.",
    "",
    "## What Changed",
    "",
    affectedAreas,
    "",
    "## Review Order",
    "",
    reviewOrder,
    "",
    "## Review Focus",
    "",
    reviewFocus,
    "",
    "## Risks",
    "",
    risks,
    "",
    "## Validation",
    "",
    "- [ ] `node tools/runtime/run-npm.cjs run typecheck`",
    "- [ ] `node tools/runtime/run-npm.cjs run lint`",
    "- [ ] `node tools/runtime/run-npm.cjs test`",
    "- [ ] Additional focused checks for the changed areas are listed in the PR body",
    "",
    "## Privacy",
    "",
    "- [ ] No private tax documents, extracted data, or generated filings were added to the repository",
    "- [ ] Any logging or screenshots avoid SSNs, EINs, account numbers, addresses, and full document contents"
  ].join("\n");
}

function renderArea(area: PullRequestArea): string {
  const files = area.files.map((file) => `  - \`${file}\``).join("\n");
  return `### ${area.title}\n${files}`;
}

function hasArea(areas: PullRequestArea[], title: string): boolean {
  return areas.some((area) => area.title === title);
}

function isDocumentationFile(file: string): boolean {
  return (
    file.startsWith("docs/") ||
    file === "README.md" ||
    file === "CONTRIBUTING.md" ||
    file === "SECURITY.md" ||
    file.endsWith("AGENTS.md")
  );
}

function isRepositoryConfig(file: string): boolean {
  return (
    file === "package.json" ||
    file === "package-lock.json" ||
    file.startsWith("tsconfig") ||
    file === "eslint.config.mjs" ||
    file === "stylelint.config.mjs" ||
    file === "vitest.config.ts" ||
    file === ".nvmrc"
  );
}

function isApiAppFile(file: string): boolean {
  return /^apps\/[^/]+\/api\//u.test(file);
}

function isWebAppFile(file: string): boolean {
  return /^apps\/[^/]+\/web\//u.test(file);
}
