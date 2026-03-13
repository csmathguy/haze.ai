import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import CableOutlinedIcon from "@mui/icons-material/CableOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import ChecklistRtlOutlinedIcon from "@mui/icons-material/ChecklistRtlOutlined";

import type { AuditRunDetail, AuditRunOverview } from "@taxes/shared";

import type { AuditRunFilters } from "./api.js";
import { FiltersBar } from "./components/FiltersBar.js";
import { MetricCard } from "./components/MetricCard.js";
import { RunDetail } from "./components/RunDetail.js";
import { RunDurationChart } from "./components/RunDurationChart.js";
import { RunList } from "./components/RunList.js";
import { formatDateTime } from "./time.js";
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
    connectionState,
    detail,
    detailError,
    filters,
    isLoadingDetail,
    isLoadingRuns,
    lastEventAt,
    runError,
    runStats,
    runs,
    selectedRunId,
    setFilters,
    setSelectedRunId,
    workflows,
    worktreePaths
  } = useAuditMonitor();

  return (
    <AuditMonitorLayout
      connectionState={connectionState}
      deferredRuns={runs}
      detail={detail}
      detailError={detailError}
      filters={filters}
      isLoadingDetail={isLoadingDetail}
      isLoadingRuns={isLoadingRuns}
      lastEventAt={lastEventAt}
      onFilterChange={setFilters}
      onSelectRun={setSelectedRunId}
      runError={runError}
      runStats={runStats}
      selectedRunId={selectedRunId}
      workflows={workflows}
      worktreePaths={worktreePaths}
    />
  );
}

interface AuditMonitorLayoutProps {
  readonly connectionState: ConnectionState;
  readonly deferredRuns: AuditRunOverview[];
  readonly detail: AuditRunDetail | null;
  readonly detailError: string | null;
  readonly filters: AuditRunFilters;
  readonly isLoadingDetail: boolean;
  readonly isLoadingRuns: boolean;
  readonly lastEventAt: string | null;
  readonly onFilterChange: (filters: AuditRunFilters) => void;
  readonly onSelectRun: (runId: string | null) => void;
  readonly runError: string | null;
  readonly runStats: RunStats;
  readonly selectedRunId: string | null;
  readonly workflows: string[];
  readonly worktreePaths: string[];
}

function AuditMonitorLayout({
  connectionState,
  deferredRuns,
  detail,
  detailError,
  filters,
  isLoadingDetail,
  isLoadingRuns,
  lastEventAt,
  onFilterChange,
  onSelectRun,
  runError,
  runStats,
  selectedRunId,
  workflows,
  worktreePaths
}: AuditMonitorLayoutProps) {
  return (
    <Hero>
      <Shell>
        <Stack spacing={3}>
          <MonitorHeader
            connectionState={connectionState}
            filters={filters}
            lastEventAt={lastEventAt}
            onFilterChange={onFilterChange}
            workflows={workflows}
            worktreePaths={worktreePaths}
          />
          {runError !== null ? <Alert severity="error">{runError}</Alert> : null}
          {detailError !== null ? <Alert severity="warning">{detailError}</Alert> : null}
          <MetricGrid runStats={runStats} />
          <ContentGrid
            detail={detail}
            isLoadingDetail={isLoadingDetail}
            isLoadingRuns={isLoadingRuns}
            onSelectRun={onSelectRun}
            runs={deferredRuns}
            selectedRunId={selectedRunId}
          />
        </Stack>
      </Shell>
    </Hero>
  );
}

function MonitorHeader({
  connectionState,
  filters,
  lastEventAt,
  onFilterChange,
  workflows,
  worktreePaths
}: Pick<
  AuditMonitorLayoutProps,
  "connectionState" | "filters" | "lastEventAt" | "onFilterChange" | "workflows" | "worktreePaths"
>) {
  return (
    <Stack spacing={1.5}>
      <Stack
        alignItems={{ sm: "center", xs: "flex-start" }}
        direction={{ sm: "row", xs: "column" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <div>
          <Typography variant="h1">Audit Monitor</Typography>
          <Typography maxWidth={760} variant="body1">
            Shared run telemetry for every worktree writing into the central audit database under your user profile.
          </Typography>
        </div>
        <Chip
          color={toConnectionColor(connectionState)}
          icon={<CableOutlinedIcon />}
          label={buildConnectionLabel(connectionState, lastEventAt)}
          variant="filled"
        />
      </Stack>
      <FiltersBar filters={filters} onChange={onFilterChange} workflows={workflows} worktreePaths={worktreePaths} />
    </Stack>
  );
}

function MetricGrid({ runStats }: { readonly runStats: RunStats }) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ lg: 3, sm: 6, xs: 12 }}>
        <MetricCard
          caption="Runs loaded for the current filters."
          icon={<QueryStatsOutlinedIcon />}
          label="Visible runs"
          value={runStats.totalRuns.toString()}
        />
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
    </Grid>
  );
}

function ContentGrid({
  detail,
  isLoadingDetail,
  isLoadingRuns,
  onSelectRun,
  runs,
  selectedRunId
}: {
  readonly detail: AuditRunDetail | null;
  readonly isLoadingDetail: boolean;
  readonly isLoadingRuns: boolean;
  readonly onSelectRun: (runId: string | null) => void;
  readonly runs: AuditRunOverview[];
  readonly selectedRunId: string | null;
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ lg: 4, xs: 12 }}>
        {isLoadingRuns && runs.length === 0 ? (
          <LoadingPanel label="Loading audit runs..." />
        ) : (
          <RunList onSelect={onSelectRun} runs={runs} selectedRunId={selectedRunId} />
        )}
      </Grid>
      <Grid size={{ lg: 8, xs: 12 }}>
        <Stack spacing={2}>
          <RunDurationChart runs={runs} />
          <RunDetail detail={detail} isLoading={isLoadingDetail} />
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

function toConnectionColor(state: ConnectionState): "default" | "error" | "success" | "warning" {
  switch (state) {
    case "connecting":
      return "warning";
    case "live":
      return "success";
    case "offline":
      return "error";
  }
}

function buildConnectionLabel(state: ConnectionState, lastEventAt: string | null): string {
  switch (state) {
    case "connecting":
      return "Connecting to live stream";
    case "live":
      return lastEventAt === null ? "Live stream connected" : `Live since ${formatDateTime(lastEventAt)}`;
    case "offline":
      return "Stream offline";
  }
}
