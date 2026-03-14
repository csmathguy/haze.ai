import { startTransition, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import {
  Alert,
  Box,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CodeReviewPullRequestDetail, CodeReviewWorkspace, ReviewLaneId } from "@taxes/shared";

import { fetchCodeReviewPullRequest, fetchCodeReviewWorkspace } from "./api.js";
import { PullRequestList } from "./components/PullRequestList.js";
import { PullRequestOverviewPanel } from "./components/PullRequestOverviewPanel.js";
import { WalkthroughDeck } from "./components/WalkthroughDeck.js";
import { countPullRequestsByState } from "./index.js";

export function App() {
  const controller = useCodeReviewController();

  if (controller.workspace === null) {
    return (
      <PageShell>
        {controller.errorMessage === null ? (
          <Alert severity="info">Loading the code review workspace...</Alert>
        ) : (
          <Alert severity="error">{controller.errorMessage}</Alert>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell>
      {controller.errorMessage === null ? null : <Alert severity="warning">{controller.errorMessage}</Alert>}
      <Hero workspace={controller.workspace} />
      {controller.workspace.showingRecentFallback ? (
        <Alert severity="info">No open pull requests were found. Showing the most recent merged and closed pull requests instead.</Alert>
      ) : null}
      <Grid container spacing={2}>
        <Grid size={{ lg: 4, xs: 12 }}>
          <PullRequestList
            pullRequests={controller.workspace.pullRequests}
            selectedPullRequestNumber={controller.selectedPullRequestNumber}
            onSelect={controller.setSelectedPullRequestNumber}
          />
        </Grid>
        <Grid size={{ lg: 8, xs: 12 }}>
          <PullRequestDetailState
            isLoading={controller.isPullRequestLoading}
            pullRequest={controller.pullRequest}
            selectedLaneId={controller.selectedLaneId}
            setSelectedLaneId={controller.setSelectedLaneId}
          />
        </Grid>
      </Grid>
    </PageShell>
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
      setPullRequest(null);
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
        setSelectedPullRequestNumber(nextWorkspace.pullRequests[0]?.number ?? null);
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

function PullRequestDetailState({
  isLoading,
  pullRequest,
  selectedLaneId,
  setSelectedLaneId
}: {
  readonly isLoading: boolean;
  readonly pullRequest: CodeReviewPullRequestDetail | null;
  readonly selectedLaneId: ReviewLaneId;
  readonly setSelectedLaneId: (laneId: ReviewLaneId) => void;
}) {
  if (isLoading && pullRequest === null) {
    return <Alert severity="info">Loading pull request detail...</Alert>;
  }

  if (pullRequest === null) {
    return <Alert severity="info">Select a pull request to review its summary, lanes, checks, and planning context.</Alert>;
  }

  const activeLane = pullRequest.lanes.find((lane) => lane.id === selectedLaneId) ?? pullRequest.lanes[0];

  if (activeLane === undefined) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <PullRequestOverviewPanel pullRequest={pullRequest} />
      <WalkthroughDeck pullRequest={pullRequest} selectedLaneId={activeLane.id} setSelectedLaneId={setSelectedLaneId} />
    </Stack>
  );
}

function PageShell({ children }: { readonly children: ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        background: `
          radial-gradient(circle at top left, ${alpha(theme.palette.secondary.main, 0.18)}, transparent 28%),
          linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)}, transparent 55%),
          ${theme.palette.background.default}
        `,
        minHeight: "100vh",
        py: 4.5
      })}
    >
      <Container maxWidth="xl">
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
      <Grid container spacing={3}>
        <Grid size={{ md: 8, xs: 12 }}>
          <Stack spacing={2}>
            <Typography variant="h1">{workspace.title}</Typography>
            <Typography maxWidth={840} variant="body1">
              {workspace.purpose}
            </Typography>
            <Typography
              maxWidth={820}
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
        </Grid>
        <Grid size={{ md: 4, xs: 12 }}>
          <Paper
            sx={(theme) => ({
              backgroundColor: alpha(theme.palette.common.white, 0.12),
              borderColor: alpha(theme.palette.common.white, 0.18),
              color: theme.palette.common.white,
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
                PRs are pulled directly from this repository and then classified into context, risks, tests, implementation, validation, and docs lanes.
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
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
