import { useEffect, useState } from "react";
import type { CodeReviewPullRequestDetail, CodeReviewReviewAction, ReviewLane, ReviewLaneId } from "@taxes/shared";

import { buildTrustSummary, createReviewNotebook, getSelectedFile, getSelectedSection, orderWalkthroughLanes, type ReviewNotebook, type ReviewNotebookEntry } from "./walkthrough.js";
import { useFollowUpAction, type FollowUpActionTone } from "./use-follow-up-action.js";
import { useReviewAction, type ReviewActionTone } from "./use-review-action.js";

export interface WalkthroughState {
  readonly activeEntry: ReviewNotebookEntry;
  readonly activeFile: ReturnType<typeof getSelectedFile>;
  readonly activeIndex: number;
  readonly activeLane: ReviewLane;
  readonly activeSection: ReturnType<typeof getSelectedSection>;
  readonly followUpActionMessage: string | null;
  readonly followUpActionTone: FollowUpActionTone;
  readonly handleNotebookChange: (patch: Partial<ReviewNotebookEntry>) => void;
  readonly isCreatingFollowUp: boolean;
  readonly isFinalStage: boolean;
  readonly isNotebookOpen: boolean;
  readonly isSubmittingReviewAction: boolean;
  readonly notebookStatus: ReviewNotebookEntry["status"];
  readonly onCreateFollowUp: () => Promise<void>;
  readonly onSubmitReviewAction: (action: CodeReviewReviewAction) => Promise<void>;
  readonly orderedLanes: ReviewLane[];
  readonly reviewActionMessage: string | null;
  readonly reviewActionTone: ReviewActionTone;
  readonly setIsNotebookOpen: (open: boolean) => void;
  readonly trustSummary: ReturnType<typeof buildTrustSummary>;
  readonly updateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
}

export function useWalkthroughState({
  onReviewSubmitted,
  pullRequest,
  selectedLaneId
}: {
  readonly onReviewSubmitted: () => Promise<void>;
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly selectedLaneId: ReviewLaneId;
}): WalkthroughState | null {
  const orderedLanes = orderWalkthroughLanes(pullRequest.lanes);
  const [notebook, setNotebook] = useState<ReviewNotebook>(() => createReviewNotebook(orderedLanes));
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const { followUpActionMessage, followUpActionTone, handleCreateFollowUp, isCreatingFollowUp, resetFollowUpAction } = useFollowUpAction(
    pullRequest,
    notebook,
    setNotebook
  );
  const {
    actionMessage: reviewActionMessage,
    actionTone: reviewActionTone,
    isSubmitting: isSubmittingReviewAction,
    submitAction
  } = useReviewAction(pullRequest.number, onReviewSubmitted);

  useNotebookLifecycle({
    orderedLanes,
    pullRequestNumber: pullRequest.number,
    resetFollowUpAction,
    selectedLaneId,
    setIsNotebookOpen,
    setNotebook
  });

  const activeIndex = orderedLanes.findIndex((lane) => lane.id === selectedLaneId);
  const activeLane = orderedLanes[activeIndex] ?? orderedLanes[0];
  if (activeLane === undefined) {
    return null;
  }
  const activeEntry = notebook[activeLane.id];
  const activeSection = getSelectedSection(activeLane, notebook);
  const activeFile = getSelectedFile(activeLane, notebook);
  const trustSummary = buildTrustSummary(pullRequest, notebook);
  const isFinalStage = activeLane.id === "validation";
  const updateEntry = createNotebookUpdater(setNotebook);

  return {
    activeEntry,
    activeFile,
    activeIndex,
    activeLane,
    activeSection,
    followUpActionMessage,
    followUpActionTone,
    handleNotebookChange: (patch) => {
      updateEntry(activeLane.id, patch);
    },
    isCreatingFollowUp,
    isFinalStage,
    isNotebookOpen,
    isSubmittingReviewAction,
    notebookStatus: activeEntry.status,
    onCreateFollowUp: handleCreateFollowUp,
    onSubmitReviewAction: submitAction,
    orderedLanes,
    reviewActionMessage,
    reviewActionTone,
    setIsNotebookOpen,
    trustSummary,
    updateEntry
  };
}

function useNotebookLifecycle({
  orderedLanes,
  pullRequestNumber,
  resetFollowUpAction,
  selectedLaneId,
  setIsNotebookOpen,
  setNotebook
}: {
  readonly orderedLanes: ReviewLane[];
  readonly pullRequestNumber: number;
  readonly resetFollowUpAction: () => void;
  readonly selectedLaneId: ReviewLaneId;
  readonly setIsNotebookOpen: (open: boolean) => void;
  readonly setNotebook: React.Dispatch<React.SetStateAction<ReviewNotebook>>;
}) {
  useEffect(() => {
    setNotebook(createReviewNotebook(orderedLanes));
    resetFollowUpAction();
    setIsNotebookOpen(false);
  }, [orderedLanes, pullRequestNumber, resetFollowUpAction, setIsNotebookOpen, setNotebook]);

  useEffect(() => {
    setNotebook((currentNotebook) => ensureLaneStarted(currentNotebook, selectedLaneId));
  }, [selectedLaneId, setNotebook]);
}

function ensureLaneStarted(notebook: ReviewNotebook, laneId: ReviewLaneId): ReviewNotebook {
  const entry = notebook[laneId];

  if (entry.status !== "not-started") {
    return notebook;
  }

  return {
    ...notebook,
    [laneId]: {
      ...entry,
      status: "in-progress"
    }
  };
}

function createNotebookUpdater(setNotebook: React.Dispatch<React.SetStateAction<ReviewNotebook>>) {
  return (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => {
    setNotebook((currentNotebook) => ({
      ...currentNotebook,
      [laneId]: {
        ...currentNotebook[laneId],
        ...patch
      }
    }));
  };
}
