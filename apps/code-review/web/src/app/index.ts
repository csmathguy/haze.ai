import type { ReviewLane, ReviewRoadmapItem, ReviewRoadmapStage } from "@taxes/shared";

export function groupRoadmapItems(items: ReviewRoadmapItem[]): Record<ReviewRoadmapStage, ReviewRoadmapItem[]> {
  return {
    later: items.filter((item) => item.stage === "later"),
    mvp: items.filter((item) => item.stage === "mvp"),
    next: items.filter((item) => item.stage === "next")
  };
}

export function summarizeLaneEvidence(lane: ReviewLane): string {
  return `${lane.evidence.length.toString()} evidence | ${lane.questions.length.toString()} questions`;
}
