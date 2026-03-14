import type { CodeReviewChangedFile, CodeReviewPullRequestDetail, ReviewLane, ReviewLaneId } from "@taxes/shared";

export type ReviewCheckpointStatus = "confirmed" | "in-progress" | "needs-follow-up" | "not-started";

export interface ReviewNotebookEntry {
  readonly concerns: string;
  readonly confirmations: string;
  readonly notes: string;
  readonly selectedFilePath?: string;
  readonly selectedSectionTitle?: string;
  readonly status: ReviewCheckpointStatus;
}

export type ReviewNotebook = Record<ReviewLaneId, ReviewNotebookEntry>;

export interface ReviewLaneSection {
  readonly files: CodeReviewChangedFile[];
  readonly title: string;
}

export interface TrustSummary {
  readonly confidenceLabel: "High confidence" | "Needs follow-up" | "Still reviewing";
  readonly confirmedLaneCount: number;
  readonly remainingRisk: string[];
  readonly valueSummary: string[];
}

const REVIEW_LANE_ORDER: readonly ReviewLaneId[] = ["context", "risks", "tests", "implementation", "validation", "docs"];

export function orderWalkthroughLanes(lanes: ReviewLane[]): ReviewLane[] {
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));

  return REVIEW_LANE_ORDER.flatMap((laneId) => {
    const lane = laneById.get(laneId);
    return lane === undefined ? [] : [lane];
  });
}

export function createReviewNotebook(lanes: ReviewLane[]): ReviewNotebook {
  const laneMap = new Map(orderWalkthroughLanes(lanes).map((lane) => [lane.id, lane]));

  return Object.fromEntries(
    REVIEW_LANE_ORDER.map((laneId) => {
      const lane = laneMap.get(laneId);
      const sections = lane === undefined ? [] : buildLaneSections(lane);

      return [
        laneId,
        {
          concerns: "",
          confirmations: "",
          notes: "",
          ...(lane?.files[0] === undefined ? {} : { selectedFilePath: lane.files[0].path }),
          ...(sections[0] === undefined ? {} : { selectedSectionTitle: sections[0].title }),
          status: "not-started" as const
        }
      ];
    })
  ) as ReviewNotebook;
}

export function buildLaneSections(lane: ReviewLane): ReviewLaneSection[] {
  if (lane.id !== "tests") {
    return [{ files: lane.files, title: lane.title }];
  }

  const sections: ReviewLaneSection[] = [
    createTagSection("End-to-end", lane.files, "e2e"),
    createTagSection("Integration", lane.files, "integration"),
    createTagSection("Unit", lane.files, "unit")
  ].filter((section) => section.files.length > 0);

  return sections.length === 0 ? [{ files: lane.files, title: lane.title }] : sections;
}

export function getSelectedSection(lane: ReviewLane, notebook: ReviewNotebook): ReviewLaneSection {
  const sections = buildLaneSections(lane);
  const selectedTitle = notebook[lane.id].selectedSectionTitle;

  return sections.find((section) => section.title === selectedTitle) ?? sections[0] ?? { files: [], title: lane.title };
}

export function getSelectedFile(lane: ReviewLane, notebook: ReviewNotebook): CodeReviewChangedFile | undefined {
  const selectedSection = getSelectedSection(lane, notebook);
  const selectedPath = notebook[lane.id].selectedFilePath;

  return selectedSection.files.find((file) => file.path === selectedPath) ?? selectedSection.files[0];
}

export function buildTrustSummary(pullRequest: CodeReviewPullRequestDetail, notebook: ReviewNotebook): TrustSummary {
  const orderedLanes = orderWalkthroughLanes(pullRequest.lanes);
  const confirmedLaneCount = orderedLanes.filter((lane) => notebook[lane.id].status === "confirmed").length;
  const remainingRisk = orderedLanes.flatMap((lane) => {
    const entry = notebook[lane.id];

    if (entry.status === "needs-follow-up") {
      return [`${lane.title}: follow-up requested`];
    }

    if (entry.concerns.trim().length > 0) {
      return [`${lane.title}: ${entry.concerns.trim()}`];
    }

    if (entry.status !== "confirmed") {
      return [`${lane.title}: checkpoint not confirmed yet`];
    }

    return [];
  });

  return {
    confidenceLabel: determineConfidenceLabel(orderedLanes.length, confirmedLaneCount, remainingRisk.length),
    confirmedLaneCount,
    remainingRisk,
    valueSummary: pullRequest.narrative.summaryBullets.slice(0, 3)
  };
}

function determineConfidenceLabel(
  laneCount: number,
  confirmedLaneCount: number,
  remainingRiskCount: number
): TrustSummary["confidenceLabel"] {
  if (remainingRiskCount > 0) {
    return "Needs follow-up";
  }

  if (laneCount > 0 && confirmedLaneCount === laneCount) {
    return "High confidence";
  }

  return "Still reviewing";
}

function createTagSection(title: string, files: CodeReviewChangedFile[], tag: string): ReviewLaneSection {
  return {
    files: files.filter((file) => file.tags.includes(tag)),
    title
  };
}
