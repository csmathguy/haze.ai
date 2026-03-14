import type { CodeReviewNarrative, CodeReviewPlanContext } from "@taxes/shared";

const PLAN_APP_URL = "http://127.0.0.1:5175/";
const BRANCH_PLAN_PATTERN = /\bplan-(\d+)\b/iu;
const BODY_PLAN_PATTERN = /\bPLAN-\d+\b/iu;
const LIST_ENTRY_PATTERN = /^[-*]\s+|^\d+\.\s+/u;
const BACKTICK_PATTERN = /`([^`]+)`/gu;

interface ParsedSection {
  readonly lines: string[];
  readonly subSections: Map<string, string[]>;
}

export function parseNarrative(body: string, title: string): CodeReviewNarrative {
  const sections = parseTopLevelSections(body);
  const summaryBullets = withFallback(getSectionListEntries(sections, "summary"), [title]);
  const reviewFocus = withFallback(getSectionListEntries(sections, "review focus"), [
    "Check the changed boundaries, local workflow impact, and reviewer-visible regressions."
  ]);
  const reviewOrder = withFallback(getSectionListEntries(sections, "review order"), ["Context", "Tests", "Implementation", "Validation", "Risks"]);
  const risks = withFallback(getSectionListEntries(sections, "risks"), ["None beyond normal regression risk."]);

  return {
    reviewFocus,
    reviewOrder,
    risks,
    summaryBullets,
    validationCommands: extractBacktickCommands(getSectionLines(sections, "validation")),
    valueSummary: summaryBullets.join(" "),
    whatChangedSections: [...getSubSections(sections, "what changed").entries()].map(([sectionTitle, lines]) => ({
      items: extractListEntries(lines),
      title: sectionTitle
    }))
  };
}

export function extractPlanContext(headRefName: string, body: string): CodeReviewPlanContext | undefined {
  const bodyMatch = BODY_PLAN_PATTERN.exec(body)?.[0]?.toUpperCase();

  if (bodyMatch !== undefined) {
    return createPlanContext(bodyMatch, "body");
  }

  const branchMatch = BRANCH_PLAN_PATTERN.exec(headRefName)?.[0];

  if (branchMatch === undefined) {
    return undefined;
  }

  return createPlanContext(branchMatch.toUpperCase(), "branch");
}

function createPlanContext(workItemId: string, source: CodeReviewPlanContext["source"]): CodeReviewPlanContext {
  return {
    source,
    url: `${PLAN_APP_URL}?workItemId=${workItemId}`,
    workItemId
  };
}

function parseTopLevelSections(markdown: string): Map<string, ParsedSection> {
  const sections = new Map<string, ParsedSection>();
  let currentSection: ParsedSection | undefined;
  let currentSubSection = "";

  for (const line of markdown.split(/\r?\n/u)) {
    const topLevelHeading = readHeading(line, "## ");

    if (topLevelHeading !== undefined) {
      currentSection = { lines: [], subSections: new Map() };
      sections.set(topLevelHeading.trim().toLowerCase(), currentSection);
      currentSubSection = "";
      continue;
    }

    if (currentSection === undefined) {
      continue;
    }

    const nestedHeading = readHeading(line, "### ");

    if (nestedHeading !== undefined) {
      currentSubSection = nestedHeading.trim();
      currentSection.subSections.set(currentSubSection, []);
      continue;
    }

    currentSection.lines.push(line);

    if (currentSubSection.length > 0) {
      currentSection.subSections.get(currentSubSection)?.push(line);
    }
  }

  return sections;
}

function getSectionListEntries(sections: Map<string, ParsedSection>, sectionName: string): string[] {
  return extractListEntries(getSectionLines(sections, sectionName));
}

function getSectionLines(sections: Map<string, ParsedSection>, sectionName: string): string[] {
  return sections.get(sectionName)?.lines ?? [];
}

function getSubSections(sections: Map<string, ParsedSection>, sectionName: string): Map<string, string[]> {
  return sections.get(sectionName)?.subSections ?? new Map<string, string[]>();
}

function extractBacktickCommands(lines: string[]): string[] {
  const commands: string[] = [];

  for (const line of lines) {
    BACKTICK_PATTERN.lastIndex = 0;
    let match = BACKTICK_PATTERN.exec(line);

    while (match !== null) {
      const command = match[1];

      if (command !== undefined) {
        commands.push(command);
      }

      match = BACKTICK_PATTERN.exec(line);
    }
  }

  return commands;
}

function extractListEntries(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => LIST_ENTRY_PATTERN.test(line))
    .map((line) => line.replace(LIST_ENTRY_PATTERN, "").trim())
    .filter((line) => line.length > 0);
}

function withFallback(items: string[], fallback: string[]): string[] {
  return items.length > 0 ? items : fallback;
}

function readHeading(line: string, prefix: string): string | undefined {
  return line.startsWith(prefix) ? line.slice(prefix.length) : undefined;
}
