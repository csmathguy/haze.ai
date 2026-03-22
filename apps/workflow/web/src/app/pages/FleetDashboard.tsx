import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";

import {
  approveWorkflowRun,
  cancelWorkflowRun,
  cleanupWorkflowRuns,
  getFleetDashboard,
  type FleetDashboardData,
  type RunSummary
} from "../api.js";
import { RunSummaryActions, RunSummaryActionButton, RunSummaryGrid } from "../components/RunSummaryGrid.js";

const LIVE_POLL_MS = 2000;
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed"]);

type StatusFilter = "all" | "completed" | "failed" | "running" | "waiting";

function formatLiveState(lastUpdatedAt: number | null): string {
  if (lastUpdatedAt === null) {
    return "Connecting...";
  }

  return `Live every ${String(LIVE_POLL_MS / 1000)}s, updated ${new Date(lastUpdatedAt).toLocaleTimeString()}`;
}

function mergeAndSortRuns(data: FleetDashboardData): RunSummary[] {
  const deduped = new Map<string, RunSummary>();

  for (const run of [...data.activeRuns, ...data.recentRuns]) {
    deduped.set(run.id, run);
  }

  return [...deduped.values()].sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
  );
}

function filterRuns(runs: RunSummary[], filter: StatusFilter): RunSummary[] {
  return filter === "all" ? runs : runs.filter((run) => run.status === filter);
}

function freezeTerminalElapsed(run: RunSummary): RunSummary {
  if (!TERMINAL_STATUSES.has(run.status) || run.completedAt === null) {
    return run;
  }

  return {
    ...run,
    elapsedMs: new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
  };
}

function useFleetDashboardPolling() {
  const [dashboardData, setDashboardData] = useState<FleetDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const data = await getFleetDashboard();
        if (cancelled) return;
        setDashboardData(data);
        setLastUpdatedAt(Date.now());
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to fetch fleet dashboard");
        }
      }
    };

    void load();
    const intervalId = setInterval(() => { void load(); }, LIVE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return { dashboardData, error, lastUpdatedAt, setDashboardData, setError, setLastUpdatedAt };
}

const StatusCounts: React.FC<{
  counts: FleetDashboardData["counts"];
}> = ({ counts }) => (
  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
    {[
      { color: "info.main", label: "Running", value: counts.running },
      { color: "warning.main", label: "Waiting", value: counts.waiting },
      { color: "error.main", label: "Failed", value: counts.failed },
      { color: "success.main", label: "Completed", value: counts.completed }
    ].map((item) => (
      <Paper key={item.label} sx={{ flex: 1, p: 2 }}>
        <Typography color={item.color} variant="h4">{item.value}</Typography>
        <Typography color="text.secondary" variant="body2">{item.label}</Typography>
      </Paper>
    ))}
  </Stack>
);

const CleanupDialog: React.FC<{
  onClose: () => void;
  onConfirm: (olderThanDays: number) => Promise<void>;
  open: boolean;
  running: boolean;
}> = ({ onClose, onConfirm, open, running }) => {
  const [olderThanDays, setOlderThanDays] = useState("14");

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>Clean up old run history</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            This removes completed and cancelled runs older than the selected number of days. Failed runs stay available.
          </Typography>
          <TextField
            label="Older Than Days"
            onChange={(event) => { setOlderThanDays(event.target.value); }}
            type="number"
            value={olderThanDays}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button disabled={running} onClick={() => { void onConfirm(Number.parseInt(olderThanDays, 10)); }} variant="contained">
          {running ? "Cleaning..." : "Clean up"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const DashboardHeader: React.FC<{
  lastUpdatedAt: number | null;
  onOpenCleanup: () => void;
}> = ({ lastUpdatedAt, onOpenCleanup }) => (
  <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ alignItems: { xs: "flex-start", lg: "center" }, justifyContent: "space-between" }}>
    <Box>
      <Typography variant="h4">Fleet Dashboard</Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Chip color="success" label="Live" size="small" />
        <Typography color="text.secondary" variant="body2">{formatLiveState(lastUpdatedAt)}</Typography>
      </Stack>
    </Box>
    <RunSummaryActions>
      <RunSummaryActionButton onClick={onOpenCleanup}>Clean Up History</RunSummaryActionButton>
    </RunSummaryActions>
  </Stack>
);

const DashboardFilters: React.FC<{
  statusFilter: StatusFilter;
  onChange: (statusFilter: StatusFilter) => void;
}> = ({ onChange, statusFilter }) => (
  <Paper sx={{ p: 2 }}>
    <Tabs value={statusFilter} onChange={(_event, nextValue: StatusFilter) => { onChange(nextValue); }}>
      <Tab label="All" value="all" />
      <Tab label="Running" value="running" />
      <Tab label="Waiting" value="waiting" />
      <Tab label="Failed" value="failed" />
      <Tab label="Completed" value="completed" />
    </Tabs>
  </Paper>
);

export const FleetDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { dashboardData, error, lastUpdatedAt, setDashboardData, setError, setLastUpdatedAt } = useFleetDashboardPolling();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancelingRunId, setCancelingRunId] = useState<string | null>(null);
  const [approvingApprovalId, setApprovingApprovalId] = useState<string | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const refreshDashboard = async (): Promise<void> => {
    setDashboardData(await getFleetDashboard());
    setLastUpdatedAt(Date.now());
  };

  const handleCancelRun = async (runId: string): Promise<void> => {
    try {
      setCancelingRunId(runId);
      await cancelWorkflowRun(runId);
      await refreshDashboard();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel run");
    } finally {
      setCancelingRunId(null);
    }
  };

  const handleApproveRun = async (approvalId: string): Promise<void> => {
    try {
      setApprovingApprovalId(approvalId);
      await approveWorkflowRun(approvalId);
      await refreshDashboard();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Failed to approve run");
    } finally {
      setApprovingApprovalId(null);
    }
  };

  const handleCleanup = async (olderThanDays: number): Promise<void> => {
    try {
      setCleanupRunning(true);
      const result = await cleanupWorkflowRuns(olderThanDays, ["completed", "cancelled"]);
      setCleanupMessage(`Removed ${result.deletedRunCount.toString()} runs, ${result.deletedStepRunCount.toString()} step runs, and ${result.deletedApprovalCount.toString()} approvals.`);
      setCleanupOpen(false);
      await refreshDashboard();
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "Failed to clean up runs");
    } finally {
      setCleanupRunning(false);
    }
  };

  const visibleRuns = dashboardData
    ? filterRuns(mergeAndSortRuns(dashboardData), statusFilter).map(freezeTerminalElapsed)
    : [];

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack spacing={3}>
        <DashboardHeader lastUpdatedAt={lastUpdatedAt} onOpenCleanup={() => { setCleanupOpen(true); }} />
        {error ? <Alert severity="error">{error}</Alert> : null}
        {cleanupMessage ? <Alert severity="success">{cleanupMessage}</Alert> : null}
        {dashboardData ? <StatusCounts counts={dashboardData.counts} /> : null}
        <DashboardFilters statusFilter={statusFilter} onChange={setStatusFilter} />
        <Paper sx={{ p: 2 }}>
          <RunSummaryGrid
            approvingApprovalId={approvingApprovalId}
            cancelingRunId={cancelingRunId}
            emptyState={dashboardData ? "No workflow runs match the active filter." : "Loading runs..."}
            onApproveRun={(approvalId) => { void handleApproveRun(approvalId); }}
            onCancelRun={(runId) => { void handleCancelRun(runId); }}
            onViewRun={(runId) => { navigate(`/runs/${runId}`); }}
            runs={visibleRuns}
          />
        </Paper>
      </Stack>
      <CleanupDialog onClose={() => { setCleanupOpen(false); }} onConfirm={handleCleanup} open={cleanupOpen} running={cleanupRunning} />
    </Container>
  );
};
