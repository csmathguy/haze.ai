import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DragIndicatorOutlinedIcon from "@mui/icons-material/DragIndicatorOutlined";
import OpenInFullOutlinedIcon from "@mui/icons-material/OpenInFullOutlined";
import { Alert, Box, Chip, Divider, Drawer, IconButton, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha, styled, useTheme } from "@mui/material/styles";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CodeReviewPullRequestDetail, ReviewLaneId } from "@taxes/shared";

import { PullRequestOverviewPanel } from "./PullRequestOverviewPanel.js";
import { WalkthroughDeck } from "./WalkthroughDeck.js";

interface PullRequestDetailDrawerProps {
  readonly drawerWidth: number;
  readonly isLoading: boolean;
  readonly onClose: () => void;
  readonly onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  readonly pullRequest: CodeReviewPullRequestDetail | null;
  readonly selectedLaneId: ReviewLaneId;
  readonly selectedPullRequestNumber: number | null;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}

export function PullRequestDetailDrawer({
  drawerWidth,
  isLoading,
  onClose,
  onResizeStart,
  pullRequest,
  selectedLaneId,
  selectedPullRequestNumber,
  setSelectedLaneId
}: PullRequestDetailDrawerProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const isOpen = selectedPullRequestNumber !== null;
  const isSelectedDetailLoaded = selectedPullRequestNumber !== null && pullRequest !== null && pullRequest.number === selectedPullRequestNumber;

  return (
    <Drawer
      anchor="right"
      hideBackdrop={isDesktop}
      ModalProps={{
        keepMounted: true
      }}
      open={isOpen}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          width: isDesktop ? drawerWidth : "100vw"
        }
      }}
      variant={isDesktop ? "persistent" : "temporary"}
    >
      {isDesktop ? <ResizeHandle drawerWidth={drawerWidth} onResizeStart={onResizeStart} /> : null}
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <DrawerHeader drawerWidth={drawerWidth} isDesktop={isDesktop} onClose={onClose} pullRequest={pullRequest} />
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

function DrawerHeader({
  drawerWidth,
  isDesktop,
  onClose,
  pullRequest
}: {
  readonly drawerWidth: number;
  readonly isDesktop: boolean;
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
      <Stack alignItems="center" direction="row" spacing={1}>
        {isDesktop ? (
          <Chip icon={<OpenInFullOutlinedIcon />} label={`${drawerWidth.toString()}px`} size="small" variant="outlined" />
        ) : null}
        <IconButton aria-label="Close pull request detail" onClick={onClose}>
          <CloseOutlinedIcon />
        </IconButton>
      </Stack>
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

function ResizeHandle({
  drawerWidth,
  onResizeStart
}: {
  readonly drawerWidth: number;
  readonly onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Box
      sx={{
        inset: "0 auto 0 0",
        pointerEvents: "none",
        position: "absolute",
        width: 20,
        zIndex: 1
      }}
    >
      <ResizeHandleButton
        aria-label={`Resize drawer currently ${drawerWidth.toString()} pixels wide`}
        onPointerDown={onResizeStart}
      >
        <DragIndicatorOutlinedIcon />
      </ResizeHandleButton>
    </Box>
  );
}

const ResizeHandleButton = styled(IconButton)(({ theme }) => ({
  "&:hover": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.08)
  },
  borderRadius: 0,
  cursor: "col-resize",
  inset: 0,
  justifyContent: "center",
  pointerEvents: "auto",
  position: "absolute",
  touchAction: "none",
  width: "100%"
}));
