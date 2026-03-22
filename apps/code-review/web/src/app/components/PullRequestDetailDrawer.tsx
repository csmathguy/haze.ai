import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { Alert, Box, Divider, Drawer, IconButton, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { CodeReviewPullRequestDetail, ReviewLaneId } from "@taxes/shared";

import { PullRequestOverviewPanel } from "./PullRequestOverviewPanel.js";
import { WalkthroughDeck } from "./WalkthroughDeck.js";

interface PullRequestDetailDrawerProps {
  readonly isLoading: boolean;
  readonly onClose: () => void;
  readonly pullRequest: CodeReviewPullRequestDetail | null;
  readonly selectedLaneId: ReviewLaneId;
  readonly selectedPullRequestNumber: number | null;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}

export function PullRequestDetailDrawer({
  isLoading,
  onClose,
  pullRequest,
  selectedLaneId,
  selectedPullRequestNumber,
  setSelectedLaneId
}: PullRequestDetailDrawerProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const isOpen = selectedPullRequestNumber !== null;
  const isSelectedDetailLoaded = selectedPullRequestNumber !== null && pullRequest !== null && pullRequest.number === selectedPullRequestNumber;

  if (isDesktop) {
    return (
      <PullRequestDetailPanel
        isLoading={isLoading}
        pullRequest={pullRequest}
        selectedLaneId={selectedLaneId}
        selectedPullRequestNumber={selectedPullRequestNumber}
        setSelectedLaneId={setSelectedLaneId}
      />
    );
  }

  return (
    <Drawer
      anchor="right"
      ModalProps={{
        keepMounted: true
      }}
      open={isOpen}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          width: "100vw"
        }
      }}
      variant="temporary"
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <DrawerHeader onClose={onClose} pullRequest={pullRequest} />
        <Divider />
        <Box sx={{ flex: 1, overflowY: "auto", p: { md: 2.5, xs: 2 } }}>
          <DrawerContent
            isLoading={isLoading}
            isSelectedDetailLoaded={isSelectedDetailLoaded}
            pullRequest={pullRequest}
            selectedLaneId={selectedLaneId}
            selectedPullRequestNumber={selectedPullRequestNumber}
            setSelectedLaneId={setSelectedLaneId}
          />
        </Box>
      </Box>
    </Drawer>
  );
}

function PullRequestDetailPanel({
  isLoading,
  pullRequest,
  selectedLaneId,
  selectedPullRequestNumber,
  setSelectedLaneId
}: {
  readonly isLoading: boolean;
  readonly pullRequest: CodeReviewPullRequestDetail | null;
  readonly selectedLaneId: ReviewLaneId;
  readonly selectedPullRequestNumber: number | null;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}) {
  const isSelectedDetailLoaded = selectedPullRequestNumber !== null && pullRequest !== null && pullRequest.number === selectedPullRequestNumber;

  return (
    <Paper sx={{ minHeight: "78vh", p: 0, overflow: "hidden" }} variant="outlined">
      <Stack spacing={0}>
        <Stack spacing={0.75} sx={{ px: 3, py: 2.25 }}>
          <Typography variant="subtitle2">Selected Pull Request</Typography>
          <Typography variant="h2">
            {pullRequest === null ? "Choose a review thread" : pullRequest.title}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {pullRequest === null
              ? "Pick a PR from the queue to start the walkthrough-first review flow."
              : "The walkthrough is the primary review surface. Use the queue only to switch threads."}
          </Typography>
        </Stack>
        <Divider />
        <Box sx={{ p: 3 }}>
          <DrawerContent
            isLoading={isLoading}
            isSelectedDetailLoaded={isSelectedDetailLoaded}
            pullRequest={pullRequest}
            selectedLaneId={selectedLaneId}
            selectedPullRequestNumber={selectedPullRequestNumber}
            setSelectedLaneId={setSelectedLaneId}
          />
        </Box>
      </Stack>
    </Paper>
  );
}

function DrawerHeader({
  onClose,
  pullRequest
}: {
  readonly onClose: () => void;
  readonly pullRequest: CodeReviewPullRequestDetail | null;
}) {
  return (
    <Stack
      alignItems="center"
      direction="row"
      justifyContent="space-between"
      spacing={1.5}
      sx={{ px: { md: 2.5, xs: 2 }, py: 1.5 }}
    >
      <div>
        <Typography variant="subtitle2">Review Drawer</Typography>
        <Typography variant="h3">
          {pullRequest === null ? "Pull request detail" : `PR #${pullRequest.number.toString()}`}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {pullRequest === null
            ? "Open a queue row to inspect the narrative, evidence, and walkthrough."
            : pullRequest.title}
        </Typography>
      </div>
      <IconButton aria-label="Close pull request detail" onClick={onClose}>
        <CloseOutlinedIcon />
      </IconButton>
    </Stack>
  );
}

function DrawerContent({
  isLoading,
  isSelectedDetailLoaded,
  pullRequest,
  selectedLaneId,
  selectedPullRequestNumber,
  setSelectedLaneId
}: {
  readonly isLoading: boolean;
  readonly isSelectedDetailLoaded: boolean;
  readonly pullRequest: CodeReviewPullRequestDetail | null;
  readonly selectedLaneId: ReviewLaneId;
  readonly selectedPullRequestNumber: number | null;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}) {
  if (selectedPullRequestNumber === null) {
    return (
      <Alert severity="info">
        Click a pull request row to open the review drawer and inspect the story, risks, codebase impact, and walkthrough.
      </Alert>
    );
  }

  if (isLoading && !isSelectedDetailLoaded) {
    return <Alert severity="info">Loading pull request detail...</Alert>;
  }

  if (pullRequest === null || !isSelectedDetailLoaded) {
    return <Alert severity="warning">The selected pull request detail is not available yet.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <PullRequestOverviewPanel pullRequest={pullRequest} />
      <WalkthroughDeck pullRequest={pullRequest} selectedLaneId={selectedLaneId} setSelectedLaneId={setSelectedLaneId} />
    </Stack>
  );
}
