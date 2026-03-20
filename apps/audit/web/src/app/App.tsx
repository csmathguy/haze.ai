import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import ChecklistRtlOutlinedIcon from "@mui/icons-material/ChecklistRtlOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import { alpha, styled } from "@mui/material/styles";

import type { AuditRunDetail, AuditRunOverview, AuditWorkItemTimeline } from "@taxes/shared";

import type { AuditRunFilters } from "./api.js";
import { MetricCard } from "./components/MetricCard.js";
import { MonitorHeader } from "./components/MonitorHeader.js";
import { RunDurationChart } from "./components/RunDurationChart.js";
import { RunList } from "./components/RunList.js";
import { WorkItemTimeline } from "./components/WorkItemTimeline.js";
import { useAuditMonitor, type ConnectionState, type RunStats } from "./useAuditMonitor.js";

const Hero = styled(Box)(({ theme }) => ({
  background: `
    radial-gradient(circle at top left, ${alpha(theme.palette.secondary.main, 0.16)}, transparent 34%),
    radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.14)}, transparent 30%),
    linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)
  `,
  minHeight: "100vh",
  paddingBottom: theme.spacing(5),
  paddingTop: theme.spacing(5)
}));

const Shell = styled(Container)(({ theme }) => ({
  position: "relative",
  zIndex: 1,
  [theme.breakpoints.up("lg")]: {
    maxWidth: "1440px"
  }
}));

export function App() {
  const {
    agentNames,
    analyticsError,
    connectionState,
    detail,
    detailError,
    filters,
    isLoadingAnalytics,
    isLoadingDetail,
    isLoadingRuns,
    isLoadingTimeline,
    lastEventAt,
    projects,
    runError,
    runStats,
    runs,
    selectedRunId,
    setFilters,
    setSelectedRunId,
    timeline,
    timelineError,
    workflows,
    workItemIds,
    worktreePaths
  } = useAuditMonitor();

  return (
    <AuditMonitorLayout
      agentNames={agentNames}
      analyticsError={analyticsError}
      connectionState={connectionState}
      detail={detail}
      detailError={detailError}
      filters={filters}
      isLoadingAnalytics={isLoadingAnalytics}
      isLoadingDetail={isLoadingDetail}
      isLoadingRuns={isLoadingRuns}
      isLoadingTimeline={isLoadingTimeline}
      lastEventAt={lastEventAt}
      onFilterChange={setFilters}
      onSelectRun={setSelectedRunId}
      projects={projects}
      runError={runError}
      runStats={runStats}
      runs={runs}
      selectedRunId={selectedRunId}
      timeline={timeline}
      timelineError={timelineError}
      workflows={workflows}
      workItemIds={workItemIds}
      worktreePaths={worktreePaths}
    />
  );
}

interface AuditMonitorLayoutProps {
  readonly agentNames: string[];
  readonly analyticsError: string | null;
  readonly connectionState: ConnectionState;
  readonly detail: AuditRunDetail | null;
  readonly detailError: string | null;
  readonly filters: AuditRunFilters;
  readonly isLoadingAnalytics: boolean;
  readonly isLoadingDetail: boolean;
  readonly isLoadingRuns: boolean;
  readonly isLoadingTimeline: boolean;
  readonly lastEventAt: string | null;
  readonly onFilterChange: (filters: AuditRunFilters) => void;
  readonly onSelectRun: (runId: string | null) => void;
  readonly projects: string[];
  readonly runError: string | null;
  readonly runStats: RunStats;
  readonly runs: AuditRunOverview[];
  readonly selectedRunId: string | null;
  readonly timeline: AuditWorkItemTimeline | null;
  readonly timelineError: string | null;
  readonly workflows: string[];
  readonly workItemIds: string[];
  readonly worktreePaths: string[];
}

function AuditMonitorLayout({
  agentNames,
  analyticsError,
  connectionState,
  detail,
  detailError,
  filters,
  isLoadingAnalytics,
  isLoadingDetail,
  isLoadingRuns,
  isLoadingTimeline,
  lastEventAt,
  onFilterChange,
  onSelectRun,
  projects,
  runError,
  runStats,
  runs,
  selectedRunId,
  timeline,
  timelineError,
  workflows,
  workItemIds,
  worktreePaths
}: AuditMonitorLayoutProps) {
  return (
    <Hero>
      <Shell>
        <Stack spacing={3}>
          <MonitorHeader
            agentNames={agentNames}
            connectionState={connectionState}
            filters={filters}
            lastEventAt={lastEventAt}
            onFilterChange={onFilterChange}
            projects={projects}
            visibleRunCount={runs.length}
            workflows={workflows}
            workItemIds={workItemIds}
            worktreePaths={worktreePaths}
          />
          {runError !== null ? <Alert severity="error">{runError}</Alert> : null}
          {analyticsError !== null ? <Alert severity="warning">{analyticsError}</Alert> : null}
          {detailError !== null ? <Alert severity="warning">{detailError}</Alert> : null}
          {timelineError !== null ? <Alert severity="warning">{timelineError}</Alert> : null}
          <MetricGrid isLoadingAnalytics={isLoadingAnalytics} runStats={runStats} />
          <ContentGrid
            detail={detail}
            detailError={detailError}
            isLoadingDetail={isLoadingDetail}
            isLoadingRuns={isLoadingRuns}
            isLoadingTimeline={isLoadingTimeline}
            onSelectRun={onSelectRun}
            runs={runs}
            selectedRunId={selectedRunId}
            timeline={timeline}
          />
        </Stack>
      </Shell>
    </Hero>
  );
}

function MetricGrid({
  isLoadingAnalytics,
  runStats
}: {
  readonly isLoadingAnalytics: boolean;
  readonly runStats: RunStats;
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard caption="Runs loaded for the current filters." icon={<QueryStatsOutlinedIcon />} label="Visible runs" value={runStats.totalRuns.toString()} />
      </Grid>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard
          caption="Runs still emitting new spans."
          icon={<PlayCircleOutlineOutlinedIcon />}
          label="Running now"
          value={runStats.runningRuns.toString()}
        />
      </Grid>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard
          caption="Completed runs with failing executions."
          icon={<ChecklistRtlOutlinedIcon />}
          label="Failures"
          value={runStats.failedRuns.toString()}
        />
      </Grid>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard
          caption="Aggregate executions across the visible run set."
          icon={<QueryStatsOutlinedIcon />}
          label="Executions"
          value={runStats.executionCount.toString()}
        />
      </Grid>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard
          caption="Logged decisions across the visible run set."
          icon={<RouteOutlinedIcon />}
          label="Decisions"
          value={runStats.decisionCount.toString()}
        />
      </Grid>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard
          caption={isLoadingAnalytics ? "Refreshing analytics..." : "Captured artifacts across the visible run set."}
          icon={<FolderOpenOutlinedIcon />}
          label="Artifacts"
          value={runStats.artifactCount.toString()}
        />
      </Grid>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard
          caption="Agent handoffs linked to the visible work."
          icon={<RouteOutlinedIcon />}
          label="Handoffs"
          value={runStats.handoffCount.toString()}
        />
      </Grid>
    </Grid>
  );
}

function ContentGrid({
  detail,
  detailError,
  isLoadingDetail,
  isLoadingRuns,
  isLoadingTimeline,
  onSelectRun,
  runs,
  selectedRunId,
  timeline
}: {
  readonly detail: AuditRunDetail | null;
  readonly detailError: string | null;
  readonly isLoadingDetail: boolean;
  readonly isLoadingRuns: boolean;
  readonly isLoadingTimeline: boolean;
  readonly onSelectRun: (runId: string | null) => void;
  readonly runs: AuditRunOverview[];
  readonly selectedRunId: string | null;
  readonly timeline: AuditWorkItemTimeline | null;
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        {isLoadingRuns && runs.length === 0 ? (
          <LoadingPanel label="Loading audit runs..." />
        ) : (
          <RunList
            detail={detail}
            detailError={detailError}
            isLoadingDetail={isLoadingDetail}
            onSelect={onSelectRun}
            runs={runs}
            selectedRunId={selectedRunId}
            timeline={timeline}
          />
        )}
      </Grid>
      <Grid size={12}>
        <Stack spacing={2}>
          <RunDurationChart runs={runs} />
          <WorkItemTimeline isLoading={isLoadingTimeline} timeline={timeline} />
        </Stack>
      </Grid>
    </Grid>
  );
}

function LoadingPanel({ label }: { readonly label: string }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      minHeight={240}
      sx={{
        border: "1px solid var(--mui-palette-divider)",
        borderRadius: "var(--mui-shape-borderRadius)",
        px: 3
      }}
    >
      <CircularProgress />
      <Typography sx={{ mt: 2 }} variant="body2">
        {label}
      </Typography>
    </Stack>
  );
}
