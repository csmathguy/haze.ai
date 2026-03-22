import { startTransition, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import { Alert, Box, Chip, Container, Grid, Stack, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { CodeReviewPullRequestDetail, CodeReviewWorkspace, ReviewLaneId } from "@taxes/shared";

import { fetchCodeReviewPullRequest, fetchCodeReviewWorkspace } from "./api.js";
import { PullRequestDetailDrawer } from "./components/PullRequestDetailDrawer.js";
import { PullRequestList } from "./components/PullRequestList.js";
import { countPullRequestsByState } from "./index.js";

export function App() {
  const controller = useCodeReviewController();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

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
      <PageShell drawerOffset={0}>
        {controller.errorMessage === null ? null : <Alert severity="warning">{controller.errorMessage}</Alert>}
        <WorkspaceHeader workspace={controller.workspace} />
        {controller.workspace.showingRecentFallback ? (
          <Alert severity="info">No open pull requests were found. Showing the most recent merged and closed pull requests instead.</Alert>
        ) : null}
        {isDesktop ? (
          <DesktopReviewLayout controller={controller} workspace={controller.workspace} />
        ) : (
          <MobileReviewLayout controller={controller} workspace={controller.workspace} />
        )}
      </PageShell>
      {isDesktop ? null : <MobileReviewDrawer controller={controller} />}
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

function DesktopReviewLayout({
  controller,
  workspace
}: {
  readonly controller: ReturnType<typeof useCodeReviewController>;
  readonly workspace: CodeReviewWorkspace;
}) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ lg: 4, xl: 3.5, xs: 12 }}>
        <PullRequestList
          pullRequests={workspace.pullRequests}
          selectedPullRequestNumber={controller.selectedPullRequestNumber}
          onSelect={controller.setSelectedPullRequestNumber}
        />
      </Grid>
      <Grid size={{ lg: 8, xl: 8.5, xs: 12 }}>
        <PullRequestDetailDrawer
          isLoading={controller.isPullRequestLoading}
          onClose={() => {
            controller.setSelectedPullRequestNumber(null);
          }}
          pullRequest={controller.pullRequest}
          selectedLaneId={controller.selectedLaneId}
          selectedPullRequestNumber={controller.selectedPullRequestNumber}
          setSelectedLaneId={controller.setSelectedLaneId}
        />
      </Grid>
    </Grid>
  );
}

function MobileReviewLayout({
  controller,
  workspace
}: {
  readonly controller: ReturnType<typeof useCodeReviewController>;
  readonly workspace: CodeReviewWorkspace;
}) {
  return (
    <>
      {controller.selectedPullRequestNumber === null ? (
        <Alert severity="info">Tap a review thread to open the walkthrough and inspect the pull request.</Alert>
      ) : null}
      <PullRequestList
        pullRequests={workspace.pullRequests}
        selectedPullRequestNumber={controller.selectedPullRequestNumber}
        onSelect={controller.setSelectedPullRequestNumber}
      />
    </>
  );
}

function MobileReviewDrawer({
  controller
}: {
  readonly controller: ReturnType<typeof useCodeReviewController>;
}) {
  return (
    <PullRequestDetailDrawer
      isLoading={controller.isPullRequestLoading}
      onClose={() => {
        controller.setSelectedPullRequestNumber(null);
      }}
      pullRequest={controller.pullRequest}
      selectedLaneId={controller.selectedLaneId}
      selectedPullRequestNumber={controller.selectedPullRequestNumber}
      setSelectedLaneId={controller.setSelectedLaneId}
    />
  );
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

function WorkspaceHeader({ workspace }: { readonly workspace: CodeReviewWorkspace }) {
  const openPullRequestCount = countPullRequestsByState(workspace.pullRequests, "OPEN");

  return (
    <Stack spacing={1.25}>
      <Typography variant="h1">{workspace.title}</Typography>
      <Typography maxWidth={960} variant="body2">
        Pick a PR, then follow the next step. The review page is designed to guide the human reviewer one checkpoint at a time.
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <HeroChip icon={<MergeTypeOutlinedIcon />} label={`${openPullRequestCount.toString()} open pull requests`} />
        <HeroChip icon={<RuleFolderOutlinedIcon />} label={`${workspace.pullRequests.length.toString()} recent review threads`} />
        <Chip label={`${workspace.repository.owner}/${workspace.repository.name}`} size="small" variant="outlined" />
      </Stack>
    </Stack>
  );
}

function HeroChip({ icon, label }: { readonly icon: ReactElement; readonly label: string }) {
  return (
    <Chip
      icon={icon}
      label={label}
      variant="outlined"
    />
  );
}
