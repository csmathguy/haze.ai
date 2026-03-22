import type { CodeReviewPullRequestDetail, ReviewLaneId } from "@taxes/shared";

import { getWalkthroughStageCopy } from "../walkthrough.js";
import { useWalkthroughState } from "../use-walkthrough-state.js";
import { NotebookDrawer } from "./NotebookDrawer.js";
import { WalkthroughDeckLayout } from "./WalkthroughDeckLayout.js";

interface WalkthroughDeckProps {
  readonly onReviewSubmitted: () => Promise<void>;
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly selectedLaneId: ReviewLaneId;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}

export function WalkthroughDeck({ onReviewSubmitted, pullRequest, selectedLaneId, setSelectedLaneId }: WalkthroughDeckProps) {
  const state = useWalkthroughState({ onReviewSubmitted, pullRequest, selectedLaneId });

  if (state === null) {
    return null;
  }

  return (
    <>
      <WalkthroughDeckLayout
        activeEntry={state.activeEntry}
        activeFile={state.activeFile}
        activeIndex={state.activeIndex}
        activeLane={state.activeLane}
        activeSection={state.activeSection}
        followUpActionMessage={state.followUpActionMessage}
        followUpActionTone={state.followUpActionTone}
        isCreatingFollowUp={state.isCreatingFollowUp}
        isSubmittingReviewAction={state.isSubmittingReviewAction}
        laneCount={state.orderedLanes.length}
        notebookStatus={state.notebookStatus}
        onCreateFollowUp={state.onCreateFollowUp}
        onOpenNotebook={() => {
          state.setIsNotebookOpen(true);
        }}
        onSelectLane={setSelectedLaneId}
        onSubmitReviewAction={state.onSubmitReviewAction}
        onUpdateEntry={state.updateEntry}
        orderedLanes={state.orderedLanes}
        pullRequest={pullRequest}
        reviewActionMessage={state.reviewActionMessage}
        reviewActionTone={state.reviewActionTone}
        trustSummary={state.trustSummary}
      />
      <NotebookDrawer
        entry={state.activeEntry}
        isFinalStage={state.isFinalStage}
        laneTitle={getWalkthroughStageCopy(state.activeLane.id).title}
        onChange={state.handleNotebookChange}
        onClose={() => {
          state.setIsNotebookOpen(false);
        }}
        open={state.isNotebookOpen}
      />
    </>
  );
}
