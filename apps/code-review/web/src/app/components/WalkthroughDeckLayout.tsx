import ChevronLeftOutlinedIcon from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import { Button, Grid, Paper, Stack, Typography } from "@mui/material";
import type { CodeReviewChangedFile, CodeReviewPullRequestDetail, CodeReviewReviewAction, ReviewLane, ReviewLaneId } from "@taxes/shared";

import type { ReviewStagePresentation } from "../review-stage.js";
import { buildReviewStagePresentation } from "../review-stage.js";
import type { FollowUpActionTone } from "../use-follow-up-action.js";
import type { ReviewActionTone } from "../use-review-action.js";
import type { ValidationReviewProps } from "../walkthrough-validation.js";
import { buildValidationReviewProps } from "../walkthrough-validation.js";
import type { ReviewLaneSection, ReviewNotebookEntry, TrustSummary } from "../walkthrough.js";
import { buildLaneSections, getWalkthroughStageCopy } from "../walkthrough.js";
import { FileDiffExplorer } from "./FileDiffExplorer.js";
import { SelectionRail, type SelectionRailItem } from "./SelectionRail.js";
import { ValidationReviewPanel } from "./ValidationReviewPanel.js";
import { WalkthroughNarrativePanel } from "./WalkthroughNarrativePanel.js";

interface WalkthroughDeckLayoutProps {
  readonly activeEntry: ReviewNotebookEntry;
  readonly activeFile: CodeReviewChangedFile | undefined;
  readonly activeIndex: number;
  readonly activeLane: ReviewLane;
  readonly activeSection: ReviewLaneSection;
  readonly followUpActionMessage: string | null;
  readonly followUpActionTone: FollowUpActionTone;
  readonly isCreatingFollowUp: boolean;
  readonly isSubmittingReviewAction: boolean;
  readonly laneCount: number;
  readonly notebookStatus: ReviewNotebookEntry["status"];
  readonly onCreateFollowUp: () => Promise<void>;
  readonly onOpenNotebook: () => void;
  readonly onSelectLane: (laneId: ReviewLaneId) => void;
  readonly onSubmitReviewAction: (action: CodeReviewReviewAction) => Promise<void>;
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly orderedLanes: ReviewLane[];
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly reviewActionMessage: string | null;
  readonly reviewActionTone: ReviewActionTone;
  readonly trustSummary: TrustSummary;
}

export function WalkthroughDeckLayout({
  activeEntry,
  activeFile,
  activeIndex,
  activeLane,
  activeSection,
  followUpActionMessage,
  followUpActionTone,
  isCreatingFollowUp,
  isSubmittingReviewAction,
  laneCount,
  notebookStatus,
  onCreateFollowUp,
  onOpenNotebook,
  onSelectLane,
  onSubmitReviewAction,
  onUpdateEntry,
  orderedLanes,
  pullRequest,
  reviewActionMessage,
  reviewActionTone,
  trustSummary
}: WalkthroughDeckLayoutProps) {
  const activeStage = getWalkthroughStageCopy(activeLane.id);
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
    <Paper sx={{ p: 2.75 }} variant="outlined">
      <Stack spacing={2.5}>
        <WalkthroughHeader
          activeIndex={activeIndex}
          laneCount={laneCount}
          laneTitle={activeStage.title}
          notebookStatus={notebookStatus}
          onMove={onSelectLane}
          onOpenNotebook={onOpenNotebook}
          orderedLanes={orderedLanes}
          stageEyebrow={activeStage.eyebrow}
        />
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
          <WalkthroughSidebar validationReviewProps={validationReviewProps} />
        </Grid>
      </Stack>
    </Paper>
  );
}

function WalkthroughHeader({
  activeIndex,
  laneCount,
  laneTitle,
  notebookStatus,
  onMove,
  onOpenNotebook,
  orderedLanes,
  stageEyebrow
}: {
  readonly activeIndex: number;
  readonly laneCount: number;
  readonly laneTitle: string;
  readonly notebookStatus: ReviewNotebookEntry["status"];
  readonly onMove: (laneId: ReviewLaneId) => void;
  readonly onOpenNotebook: () => void;
  readonly orderedLanes: ReviewLane[];
  readonly stageEyebrow: string;
}) {
  const previousLane = activeIndex > 0 ? orderedLanes[activeIndex - 1] : undefined;
  const nextLane = activeIndex < laneCount - 1 ? orderedLanes[activeIndex + 1] : undefined;

  return (
    <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
      <Stack spacing={0.35}>
        <Typography variant="subtitle2">{stageEyebrow}</Typography>
        <Typography variant="h5">{laneTitle}</Typography>
        <Typography color="text.secondary" variant="body2">
          Step {(activeIndex + 1).toString()} of {laneCount.toString()}. Finish this step, then move forward. You do not need to inspect the whole PR at once.
        </Typography>
      </Stack>
      <Stack alignItems={{ sm: "center", xs: "stretch" }} direction={{ sm: "row", xs: "column" }} spacing={1}>
        <Button onClick={onOpenNotebook} size="small" startIcon={<EditNoteOutlinedIcon />} variant="text">
          Notes ({formatNotebookStatus(notebookStatus)})
        </Button>
        <Button
          disabled={previousLane === undefined}
          onClick={() => {
            if (previousLane !== undefined) {
              onMove(previousLane.id);
            }
          }}
          size="small"
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
          size="small"
          variant="contained"
        >
          Next checkpoint
        </Button>
      </Stack>
    </Stack>
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
  readonly activeFile: CodeReviewChangedFile | undefined;
  readonly activeLane: ReviewLane;
  readonly activeSectionTitle: string;
  readonly fileItems: SelectionRailItem[];
  readonly laneSections: ReviewLaneSection[];
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly pullRequest: CodeReviewPullRequestDetail;
}) {
  return (
    <Grid size={{ lg: activeLane.id === "validation" ? 8 : 12, xs: 12 }}>
      <WalkthroughContentColumn
        activeLane={activeLane}
        activeSectionTitle={activeSectionTitle}
        fileItems={fileItems}
        laneSections={laneSections}
        onUpdateEntry={onUpdateEntry}
        pullRequest={pullRequest}
        selectedFilePath={activeFile?.path}
        stagePresentation={buildReviewStagePresentation(pullRequest, activeLane.id)}
      />
      <FileDiffExplorer file={activeFile} />
    </Grid>
  );
}

function WalkthroughSidebar({ validationReviewProps }: { readonly validationReviewProps: ValidationReviewProps }) {
  return (
    <Grid size={{ lg: 4, xs: 12 }}>
      <Stack spacing={2}>
        <ValidationReviewPanel {...validationReviewProps} />
      </Stack>
    </Grid>
  );
}

function WalkthroughContentColumn({
  activeLane,
  activeSectionTitle,
  fileItems,
  laneSections,
  onUpdateEntry,
  pullRequest,
  selectedFilePath,
  stagePresentation
}: {
  readonly activeLane: ReviewLane;
  readonly activeSectionTitle: string;
  readonly fileItems: SelectionRailItem[];
  readonly laneSections: ReviewLaneSection[];
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly selectedFilePath: string | undefined;
  readonly stagePresentation: ReviewStagePresentation;
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

function createFileItems(files: ReviewLane["files"]): SelectionRailItem[] {
  return files.map((file) => ({
    subtitle: file.explanation.summary,
    title: file.path
  }));
}

function formatNotebookStatus(status: ReviewNotebookEntry["status"]) {
  if (status === "confirmed") {
    return "confirmed";
  }

  if (status === "needs-follow-up") {
    return "follow-up";
  }

  if (status === "in-progress") {
    return "draft";
  }

  return "empty";
}

function createSectionSelectionPatch(laneSections: ReviewLaneSection[], title: string): Partial<ReviewNotebookEntry> {
  const section = laneSections.find((candidate) => candidate.title === title);

  if (section?.files[0]?.path === undefined) {
    return { selectedSectionTitle: title };
  }

  return {
    selectedFilePath: section.files[0].path,
    selectedSectionTitle: title
  };
}
