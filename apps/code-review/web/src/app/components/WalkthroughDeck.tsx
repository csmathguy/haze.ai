import { useEffect, useState } from "react";
import ChevronLeftOutlinedIcon from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import { Button, Grid, Paper, Stack, Typography } from "@mui/material";
import type { CodeReviewPullRequestDetail, ReviewLane, ReviewLaneId } from "@taxes/shared";

import {
  buildLaneSections,
  buildTrustSummary,
  createReviewNotebook,
  getWalkthroughStageCopy,
  getSelectedFile,
  getSelectedSection,
  orderWalkthroughLanes,
  type ReviewNotebook,
  type ReviewNotebookEntry
} from "../walkthrough.js";
import { buildValidationReviewProps, type ValidationReviewProps } from "../walkthrough-validation.js";
import { buildReviewStagePresentation } from "../review-stage.js";
import { useFollowUpAction, type FollowUpActionTone } from "../use-follow-up-action.js";
import { useReviewAction, type ReviewActionTone } from "../use-review-action.js";
import { FileDiffExplorer } from "./FileDiffExplorer.js";
import { ReviewNotebookPanel } from "./ReviewNotebookPanel.js";
import { SelectionRail, type SelectionRailItem } from "./SelectionRail.js";
import { ValidationReviewPanel } from "./ValidationReviewPanel.js";
import { WalkthroughNarrativePanel } from "./WalkthroughNarrativePanel.js";

interface WalkthroughDeckProps {
  readonly onReviewSubmitted: () => Promise<void>;
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly selectedLaneId: ReviewLaneId;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}

export function WalkthroughDeck({ onReviewSubmitted, pullRequest, selectedLaneId, setSelectedLaneId }: WalkthroughDeckProps) {
  const orderedLanes = orderWalkthroughLanes(pullRequest.lanes);
  const [notebook, setNotebook] = useState<ReviewNotebook>(() => createReviewNotebook(orderedLanes));
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

  useEffect(() => {
    setNotebook(createReviewNotebook(orderedLanes));
    resetFollowUpAction();
  }, [pullRequest.number]);

  useEffect(() => {
    setNotebook((currentNotebook) => ensureLaneStarted(currentNotebook, selectedLaneId));
  }, [selectedLaneId]);

  const activeIndex = orderedLanes.findIndex((lane) => lane.id === selectedLaneId);
  const activeLane = orderedLanes[activeIndex] ?? orderedLanes[0];

  if (activeLane === undefined) {
    return null;
  }

  const activeEntry = notebook[activeLane.id];
  const activeSection = getSelectedSection(activeLane, notebook);
  const activeFile = getSelectedFile(activeLane, notebook);
  const activeStage = getWalkthroughStageCopy(activeLane.id);
  const trustSummary = buildTrustSummary(pullRequest, notebook);

  function updateEntry(laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) {
    setNotebook((currentNotebook) => ({
      ...currentNotebook,
      [laneId]: {
        ...currentNotebook[laneId],
        ...patch
      }
    }));
  }

  return (
    <Paper sx={{ p: 2.75 }} variant="outlined">
      <Stack spacing={2.5}>
        <WalkthroughHeader
          activeIndex={activeIndex}
          laneCount={orderedLanes.length}
          laneTitle={activeStage.title}
          onMove={setSelectedLaneId}
          orderedLanes={orderedLanes}
          stageEyebrow={activeStage.eyebrow}
        />
        <WalkthroughBody
          activeEntry={activeEntry}
          activeFile={activeFile}
          activeLane={activeLane}
          activeSection={activeSection}
          followUpActionMessage={followUpActionMessage}
          followUpActionTone={followUpActionTone}
          isCreatingFollowUp={isCreatingFollowUp}
          isSubmittingReviewAction={isSubmittingReviewAction}
          laneCount={orderedLanes.length}
          onCreateFollowUp={handleCreateFollowUp}
          onSubmitReviewAction={submitAction}
          onUpdateEntry={updateEntry}
          pullRequest={pullRequest}
          reviewActionMessage={reviewActionMessage}
          reviewActionTone={reviewActionTone}
          trustSummary={trustSummary}
        />
      </Stack>
    </Paper>
  );
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

function WalkthroughHeader({
  activeIndex,
  laneCount,
  laneTitle,
  onMove,
  orderedLanes,
  stageEyebrow
}: {
  readonly activeIndex: number;
  readonly laneCount: number;
  readonly laneTitle: string;
  readonly onMove: (laneId: ReviewLaneId) => void;
  readonly orderedLanes: ReviewLane[];
  readonly stageEyebrow: string;
}) {
  const previousLane = activeIndex > 0 ? orderedLanes[activeIndex - 1] : undefined;
  const nextLane = activeIndex < laneCount - 1 ? orderedLanes[activeIndex + 1] : undefined;

  return (
    <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{stageEyebrow}</Typography>
        <Typography variant="h2">{laneTitle}</Typography>
        <Typography color="text.secondary" variant="body2">
          Step {(activeIndex + 1).toString()} of {laneCount.toString()}. Finish this step, then move forward. You do not need to inspect the whole PR at once.
        </Typography>
      </Stack>
      <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
        <Button
          disabled={previousLane === undefined}
          onClick={() => {
            if (previousLane !== undefined) {
              onMove(previousLane.id);
            }
          }}
          startIcon={<ChevronLeftOutlinedIcon />}
          variant="outlined"
        >
          Previous
        </Button>
        <Button
          disabled={nextLane === undefined}
          endIcon={<ChevronRightOutlinedIcon />}
          onClick={() => {
            if (nextLane !== undefined) {
              onMove(nextLane.id);
            }
          }}
          variant="contained"
        >
          Next checkpoint
        </Button>
      </Stack>
    </Stack>
  );
}

function WalkthroughBody({
  activeEntry,
  activeFile,
  activeLane,
  activeSection,
  followUpActionMessage,
  followUpActionTone,
  isCreatingFollowUp,
  isSubmittingReviewAction,
  laneCount,
  onCreateFollowUp,
  onSubmitReviewAction,
  onUpdateEntry,
  pullRequest,
  reviewActionMessage,
  reviewActionTone,
  trustSummary
}: {
  readonly activeEntry: ReviewNotebookEntry;
  readonly activeFile: ReturnType<typeof getSelectedFile>;
  readonly activeLane: ReviewLane;
  readonly activeSection: ReturnType<typeof getSelectedSection>;
  readonly followUpActionMessage: string | null;
  readonly followUpActionTone: FollowUpActionTone;
  readonly isCreatingFollowUp: boolean;
  readonly isSubmittingReviewAction: boolean;
  readonly laneCount: number;
  readonly onCreateFollowUp: () => Promise<void>;
  readonly onSubmitReviewAction: (action: "approve" | "request-changes") => Promise<void>;
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly reviewActionMessage: string | null;
  readonly reviewActionTone: ReviewActionTone;
  readonly trustSummary: ReturnType<typeof buildTrustSummary>;
}) {
  const laneSections = buildLaneSections(activeLane);
  const validationReviewProps = buildValidationReviewProps({
    activeEntry,
    activeLane,
    followUpActionMessage,
    followUpActionTone,
    isCreatingFollowUp,
    isSubmittingReviewAction,
    onCreateFollowUp,
    onSubmitReviewAction,
    pullRequest,
    reviewActionMessage,
    reviewActionTone,
    totalLaneCount: laneCount,
    trustSummary
  });
  const fileItems = createFileItems(activeSection.files);

  return (
    <Grid container spacing={2}>
      <WalkthroughMainColumn
        activeFile={activeFile}
        activeLane={activeLane}
        activeSectionTitle={activeSection.title}
        fileItems={fileItems}
        laneSections={laneSections}
        onUpdateEntry={onUpdateEntry}
        pullRequest={pullRequest}
      />
      <WalkthroughSidebar
        activeEntry={activeEntry}
        activeLaneId={activeLane.id}
        onUpdateEntry={onUpdateEntry}
        validationReviewProps={validationReviewProps}
      />
    </Grid>
  );
}

function WalkthroughMainColumn({
  activeFile,
  activeLane,
  activeSectionTitle,
  fileItems,
  laneSections,
  onUpdateEntry,
  pullRequest
}: {
  readonly activeFile: ReturnType<typeof getSelectedFile>;
  readonly activeLane: ReviewLane;
  readonly activeSectionTitle: string;
  readonly fileItems: SelectionRailItem[];
  readonly laneSections: ReturnType<typeof buildLaneSections>;
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly pullRequest: CodeReviewPullRequestDetail;
}) {
  return (
    <Grid size={{ lg: 8, xs: 12 }}>
      <WalkthroughContentColumn
        pullRequest={pullRequest}
        activeLane={activeLane}
        activeSectionTitle={activeSectionTitle}
        fileItems={fileItems}
        laneSections={laneSections}
        onUpdateEntry={onUpdateEntry}
        selectedFilePath={activeFile?.path}
        stagePresentation={buildReviewStagePresentation(pullRequest, activeLane.id)}
      />
      <FileDiffExplorer file={activeFile} />
    </Grid>
  );
}

function createFileItems(files: ReviewLane["files"]): SelectionRailItem[] {
  return files.map((file) => ({
    subtitle: file.explanation.summary,
    title: file.path
  }));
}

function WalkthroughSidebar({
  activeEntry,
  activeLaneId,
  onUpdateEntry,
  validationReviewProps
}: {
  readonly activeEntry: ReviewNotebookEntry;
  readonly activeLaneId: ReviewLaneId;
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly validationReviewProps: ValidationReviewProps;
}) {
  return (
    <Grid size={{ lg: 4, xs: 12 }}>
      <Stack spacing={2}>
        <ReviewNotebookPanel
          entry={activeEntry}
          isFinalStage={validationReviewProps.isVisible}
          laneTitle={getWalkthroughStageCopy(activeLaneId).title}
          onChange={(patch) => {
            onUpdateEntry(activeLaneId, patch);
          }}
        />
        <ValidationReviewPanel {...validationReviewProps} />
      </Stack>
    </Grid>
  );
}

function WalkthroughContentColumn({
  pullRequest,
  activeLane,
  activeSectionTitle,
  fileItems,
  laneSections,
  onUpdateEntry,
  selectedFilePath,
  stagePresentation
}: {
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly activeLane: ReviewLane;
  readonly activeSectionTitle: string;
  readonly fileItems: SelectionRailItem[];
  readonly laneSections: ReturnType<typeof buildLaneSections>;
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly selectedFilePath: string | undefined;
  readonly stagePresentation: ReturnType<typeof buildReviewStagePresentation>;
}) {
  return (
    <Stack spacing={2}>
      <WalkthroughNarrativePanel lane={activeLane} pullRequest={pullRequest} stagePresentation={stagePresentation} />
      {laneSections.length > 1 ? (
        <SelectionRail
          activeTitle={activeSectionTitle}
          items={laneSections.map((section) => ({
            subtitle: `${section.files.length.toString()} files`,
            title: section.title
          }))}
          onSelect={(title) => {
            onUpdateEntry(activeLane.id, createSectionSelectionPatch(laneSections, title));
          }}
          title="Sections"
        />
      ) : null}
      <SelectionRail
        activeTitle={selectedFilePath}
        items={fileItems}
        onSelect={(title) => {
          onUpdateEntry(activeLane.id, { selectedFilePath: title });
        }}
        title="Files"
      />
    </Stack>
  );
}

function createSectionSelectionPatch(
  laneSections: ReturnType<typeof buildLaneSections>,
  title: string
): Partial<ReviewNotebookEntry> {
  const section = laneSections.find((candidate) => candidate.title === title);

  if (section?.files[0]?.path === undefined) {
    return { selectedSectionTitle: title };
  }

  return {
    selectedFilePath: section.files[0].path,
    selectedSectionTitle: title
  };
}
