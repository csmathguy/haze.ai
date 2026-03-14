import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from "react";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import { Alert, Box, Chip, Container, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { CodeReviewPullRequestDetail, CodeReviewWorkspace, ReviewLaneId } from "@taxes/shared";

import { fetchCodeReviewPullRequest, fetchCodeReviewWorkspace } from "./api.js";
import { PullRequestDetailDrawer } from "./components/PullRequestDetailDrawer.js";
import { PullRequestList } from "./components/PullRequestList.js";
import { countPullRequestsByState } from "./index.js";

const DEFAULT_DRAWER_WIDTH = 860;
const MIN_DRAWER_WIDTH = 640;
const VIEWPORT_MARGIN = 220;

export function App() {
  const controller = useCodeReviewController();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const { drawerWidth, startResize } = useResizableDrawer(isDesktop);
  const drawerOffset = isDesktop && controller.selectedPullRequestNumber !== null ? drawerWidth + 28 : 0;

  if (controller.workspace === null) {
    return (
      <PageShell drawerOffset={0}>
        {controller.errorMessage === null ? (
          <Alert severity="info">Loading the code review workspace...</Alert>
        ) : (
          <Alert severity="error">{controller.errorMessage}</Alert>
        )}
      </PageShell>
    );
  }

  return (
    <>
      <PageShell drawerOffset={drawerOffset}>
        {controller.errorMessage === null ? null : <Alert severity="warning">{controller.errorMessage}</Alert>}
        <Hero workspace={controller.workspace} />
        {controller.workspace.showingRecentFallback ? (
          <Alert severity="info">No open pull requests were found. Showing the most recent merged and closed pull requests instead.</Alert>
        ) : null}
        {controller.selectedPullRequestNumber === null ? (
          <Alert severity="info">Click a row in the review queue to open the pull request drawer.</Alert>
        ) : null}
        <PullRequestList
          pullRequests={controller.workspace.pullRequests}
          selectedPullRequestNumber={controller.selectedPullRequestNumber}
          onSelect={controller.setSelectedPullRequestNumber}
        />
      </PageShell>
      <PullRequestDetailDrawer
        drawerWidth={drawerWidth}
        isLoading={controller.isPullRequestLoading}
        onClose={() => {
          controller.setSelectedPullRequestNumber(null);
        }}
        onResizeStart={startResize}
        pullRequest={controller.pullRequest}
        selectedLaneId={controller.selectedLaneId}
        selectedPullRequestNumber={controller.selectedPullRequestNumber}
        setSelectedLaneId={controller.setSelectedLaneId}
      />
    </>
  );
}

function useCodeReviewController() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPullRequestLoading, setIsPullRequestLoading] = useState(false);
  const [pullRequest, setPullRequest] = useState<CodeReviewPullRequestDetail | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<ReviewLaneId>("context");
  const [selectedPullRequestNumber, setSelectedPullRequestNumber] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<CodeReviewWorkspace | null>(null);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (selectedPullRequestNumber === null) {
      return;
    }

    void loadPullRequest(selectedPullRequestNumber);
  }, [selectedPullRequestNumber]);

  async function loadWorkspace(): Promise<void> {
    setErrorMessage(null);

    try {
      const nextWorkspace = await fetchCodeReviewWorkspace();

      startTransition(() => {
        setWorkspace(nextWorkspace);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the code review workspace.");
    }
  }

  async function loadPullRequest(pullRequestNumber: number): Promise<void> {
    setIsPullRequestLoading(true);
    setErrorMessage(null);

    try {
      const nextPullRequest = await fetchCodeReviewPullRequest(pullRequestNumber);

      startTransition(() => {
        setPullRequest(nextPullRequest);
        setSelectedLaneId(nextPullRequest.lanes[0]?.id ?? "context");
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the pull request detail.");
    } finally {
      setIsPullRequestLoading(false);
    }
  }

  return {
    errorMessage,
    isPullRequestLoading,
    pullRequest,
    selectedLaneId,
    selectedPullRequestNumber,
    setSelectedLaneId,
    setSelectedPullRequestNumber,
    workspace
  };
}

function clampDrawerWidth(width: number): number {
  if (typeof window === "undefined") {
    return width;
  }

  const maxWidth = Math.max(MIN_DRAWER_WIDTH, window.innerWidth - VIEWPORT_MARGIN);
  return Math.max(MIN_DRAWER_WIDTH, Math.min(maxWidth, width));
}

function useResizableDrawer(isDesktop: boolean) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_DRAWER_WIDTH);

  const stopResize = useEffectEvent(() => {
    window.removeEventListener("mousemove", handleResize);
    window.removeEventListener("mouseup", stopResize);
  });
  const handleResize = useEffectEvent((event: MouseEvent) => {
    setDrawerWidth(clampDrawerWidth(resizeStartWidthRef.current + (resizeStartXRef.current - event.clientX)));
  });

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const handleWindowResize = () => {
      setDrawerWidth((currentWidth) => clampDrawerWidth(currentWidth));
    };

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      stopResize();
    };
  }, [isDesktop, stopResize]);

  function startResize(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!isDesktop) {
      return;
    }

    event.preventDefault();
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = drawerWidth;
    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", stopResize);
  }

  return {
    drawerWidth,
    startResize
  };
}

function PageShell({ children, drawerOffset }: { readonly children: ReactNode; readonly drawerOffset: number }) {
  return (
    <Box
      sx={(theme) => ({
        background: `
          radial-gradient(circle at top left, ${alpha(theme.palette.secondary.main, 0.18)}, transparent 28%),
          linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)}, transparent 55%),
          ${theme.palette.background.default}
        `,
        minHeight: "100vh",
        pr: { lg: `${drawerOffset.toString()}px`, xs: 0 },
        py: 4.5,
        transition: "padding-right 140ms ease-out"
      })}
    >
      <Container maxWidth={false} sx={{ px: { lg: 4, md: 3, xs: 2 } }}>
        <Stack spacing={2.5}>{children}</Stack>
      </Container>
    </Box>
  );
}

function Hero({ workspace }: { readonly workspace: CodeReviewWorkspace }) {
  const openPullRequestCount = countPullRequestsByState(workspace.pullRequests, "OPEN");

  return (
    <Paper
      sx={(theme) => ({
        background: `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.96)}, ${alpha(theme.palette.secondary.main, 0.86)})`,
        color: theme.palette.common.white,
        p: { md: 4, xs: 3 }
      })}
    >
      <Stack direction={{ lg: "row", xs: "column" }} justifyContent="space-between" spacing={3}>
        <Stack spacing={2}>
          <Typography variant="h1">{workspace.title}</Typography>
          <Typography maxWidth={960} variant="body1">
            {workspace.purpose}
          </Typography>
          <Typography
            maxWidth={900}
            sx={(theme) => ({
              color: alpha(theme.palette.common.white, 0.84)
            })}
            variant="body2"
          >
            {workspace.trustStatement}
          </Typography>
          <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
            <HeroChip icon={<MergeTypeOutlinedIcon />} label={`${openPullRequestCount.toString()} open pull requests`} />
            <HeroChip icon={<RuleFolderOutlinedIcon />} label={`${workspace.pullRequests.length.toString()} recent review threads`} />
          </Stack>
        </Stack>
        <Paper
          sx={(theme) => ({
            alignSelf: "stretch",
            backgroundColor: alpha(theme.palette.common.white, 0.12),
            borderColor: alpha(theme.palette.common.white, 0.18),
            color: theme.palette.common.white,
            maxWidth: 360,
            p: 2.5
          })}
          variant="outlined"
        >
          <Stack spacing={1.25}>
            <Typography
              sx={(theme) => ({
                color: alpha(theme.palette.common.white, 0.8)
              })}
              variant="subtitle2"
            >
              Repository
            </Typography>
            <Typography variant="h3">
              {workspace.repository.owner}/{workspace.repository.name}
            </Typography>
            <Typography
              sx={(theme) => ({
                color: alpha(theme.palette.common.white, 0.82)
              })}
              variant="body2"
            >
              The queue is now optimized for scan speed, while the drawer is where the PR gets explained, justified, and pressure-tested before a human merge decision.
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}

function HeroChip({ icon, label }: { readonly icon: ReactElement; readonly label: string }) {
  return (
    <Chip
      icon={icon}
      label={label}
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.common.white, 0.14),
        border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
        color: theme.palette.common.white
      })}
      variant="outlined"
    />
  );
}
