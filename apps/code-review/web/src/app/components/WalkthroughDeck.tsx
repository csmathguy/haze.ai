import { useEffect, useState } from "react";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import ChevronLeftOutlinedIcon from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Button, Grid, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CodeReviewPullRequestDetail, ReviewLane, ReviewLaneId } from "@taxes/shared";

import {
  buildLaneSections,
  buildTrustSummary,
  createReviewNotebook,
  getSelectedFile,
  getSelectedSection,
  orderWalkthroughLanes,
  type ReviewCheckpointStatus,
  type ReviewNotebook,
  type ReviewNotebookEntry
} from "../walkthrough.js";
import { FileDiffExplorer } from "./FileDiffExplorer.js";
import { ReviewNotebookPanel } from "./ReviewNotebookPanel.js";
import { SelectionRail, type SelectionRailItem } from "./SelectionRail.js";
import { TrustSummaryPanel } from "./TrustSummaryPanel.js";

interface WalkthroughDeckProps {
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly selectedLaneId: ReviewLaneId;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}

export function WalkthroughDeck({ pullRequest, selectedLaneId, setSelectedLaneId }: WalkthroughDeckProps) {
  const orderedLanes = orderWalkthroughLanes(pullRequest.lanes);
  const [notebook, setNotebook] = useState<ReviewNotebook>(() => createReviewNotebook(orderedLanes));

  useEffect(() => {
    setNotebook(createReviewNotebook(orderedLanes));
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
        <WalkthroughHeader activeIndex={activeIndex} laneCount={orderedLanes.length} laneTitle={activeLane.title} onMove={setSelectedLaneId} orderedLanes={orderedLanes} />
        <LaneCheckpointBar activeLaneId={activeLane.id} notebook={notebook} onSelectLane={setSelectedLaneId} orderedLanes={orderedLanes} />
        <WalkthroughBody
          activeEntry={activeEntry}
          activeFile={activeFile}
          activeLane={activeLane}
          activeSection={activeSection}
          laneCount={orderedLanes.length}
          onUpdateEntry={updateEntry}
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
  orderedLanes
}: {
  readonly activeIndex: number;
  readonly laneCount: number;
  readonly laneTitle: string;
  readonly onMove: (laneId: ReviewLaneId) => void;
  readonly orderedLanes: ReviewLane[];
}) {
  const previousLane = activeIndex > 0 ? orderedLanes[activeIndex - 1] : undefined;
  const nextLane = activeIndex < laneCount - 1 ? orderedLanes[activeIndex + 1] : undefined;

  return (
    <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
      <div>
        <Typography variant="subtitle2">Guided Walkthrough</Typography>
        <Typography variant="h2">{laneTitle} checkpoint</Typography>
        <Typography color="text.secondary" variant="body2">
          Step {(activeIndex + 1).toString()} of {laneCount.toString()}.
        </Typography>
      </div>
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

function LaneCheckpointBar({
  activeLaneId,
  notebook,
  onSelectLane,
  orderedLanes
}: {
  readonly activeLaneId: ReviewLaneId;
  readonly notebook: ReviewNotebook;
  readonly onSelectLane: (laneId: ReviewLaneId) => void;
  readonly orderedLanes: ReviewLane[];
}) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {orderedLanes.map((lane) => {
        const status = notebook[lane.id].status;
        const isSelected = lane.id === activeLaneId;

        return (
          <Button
            color={resolveLaneButtonColor(status, isSelected)}
            key={lane.id}
            onClick={() => {
              onSelectLane(lane.id);
            }}
            startIcon={resolveLaneButtonIcon(status)}
            variant={isSelected ? "contained" : "outlined"}
          >
            {lane.title}
          </Button>
        );
      })}
    </Stack>
  );
}

function WalkthroughBody({
  activeEntry,
  activeFile,
  activeLane,
  activeSection,
  laneCount,
  onUpdateEntry,
  trustSummary
}: {
  readonly activeEntry: ReviewNotebookEntry;
  readonly activeFile: ReturnType<typeof getSelectedFile>;
  readonly activeLane: ReviewLane;
  readonly activeSection: ReturnType<typeof getSelectedSection>;
  readonly laneCount: number;
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly trustSummary: ReturnType<typeof buildTrustSummary>;
}) {
  const laneSections = buildLaneSections(activeLane);
  const fileItems = activeSection.files.map((file) => ({
    subtitle: file.explanation.summary,
    title: file.path
  }));

  return (
    <Grid container spacing={2}>
      <Grid size={{ lg: 8, xs: 12 }}>
        <WalkthroughContentColumn
          activeLane={activeLane}
          activeSectionTitle={activeSection.title}
          fileItems={fileItems}
          laneSections={laneSections}
          onUpdateEntry={onUpdateEntry}
          selectedFilePath={activeFile?.path}
        />
        <FileDiffExplorer file={activeFile} />
      </Grid>
      <Grid size={{ lg: 4, xs: 12 }}>
        <Stack spacing={2}>
          <ReviewNotebookPanel
            entry={activeEntry}
            laneTitle={activeLane.title}
            onChange={(patch) => {
              onUpdateEntry(activeLane.id, patch);
            }}
          />
          <TrustSummaryPanel summary={trustSummary} totalLaneCount={laneCount} />
        </Stack>
      </Grid>
    </Grid>
  );
}

function WalkthroughContentColumn({
  activeLane,
  activeSectionTitle,
  fileItems,
  laneSections,
  onUpdateEntry,
  selectedFilePath
}: {
  readonly activeLane: ReviewLane;
  readonly activeSectionTitle: string;
  readonly fileItems: SelectionRailItem[];
  readonly laneSections: ReturnType<typeof buildLaneSections>;
  readonly onUpdateEntry: (laneId: ReviewLaneId, patch: Partial<ReviewNotebookEntry>) => void;
  readonly selectedFilePath: string | undefined;
}) {
  return (
    <Stack spacing={2}>
      <LaneNarrativePanel lane={activeLane} />
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

function resolveLaneButtonColor(
  status: ReviewCheckpointStatus,
  isSelected: boolean
): "primary" | "secondary" | "success" | "warning" {
  if (status === "needs-follow-up") {
    return "warning";
  }

  if (status === "confirmed") {
    return "success";
  }

  if (isSelected) {
    return "secondary";
  }

  return "primary";
}

function resolveLaneButtonIcon(status: ReviewCheckpointStatus) {
  if (status === "confirmed") {
    return <TaskAltOutlinedIcon />;
  }

  if (status === "needs-follow-up") {
    return <WarningAmberOutlinedIcon />;
  }

  return <AutoStoriesOutlinedIcon />;
}

function LaneNarrativePanel({ lane }: { readonly lane: ReviewLane }) {
  return (
    <Paper
      sx={(theme) => ({
        background: `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.94)})`,
        p: 2.25
      })}
      variant="outlined"
    >
      <Grid container spacing={2}>
        <Grid size={{ md: 4, xs: 12 }}>
          <NarrativeBlock items={lane.highlights} title="Highlights" />
        </Grid>
        <Grid size={{ md: 4, xs: 12 }}>
          <NarrativeBlock items={lane.questions} title="Questions" />
        </Grid>
        <Grid size={{ md: 4, xs: 12 }}>
          <NarrativeBlock items={lane.evidence} title="Evidence" />
        </Grid>
      </Grid>
    </Paper>
  );
}

function NarrativeBlock({ items, title }: { readonly items: string[]; readonly title: string }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      {items.map((item) => (
        <Typography key={item} variant="body2">
          {item}
        </Typography>
      ))}
    </Stack>
  );
}
