import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Typography,
  Button,
  Stack,
  Tabs,
  Tab
} from "@mui/material";
import { Refresh as RefreshIcon, CheckCircle as CheckCircleIcon, Cancel as CancelIcon } from "@mui/icons-material";

import { getFleetDashboard, cancelWorkflowRun, approveWorkflowRun, type RunSummary, type FleetDashboardData } from "../api.js";

const getStatusColor = (status: string): "success" | "warning" | "error" | "info" => {
  switch (status.toLowerCase()) {
    case "completed":
      return "success";
    case "running":
      return "info";
    case "waiting":
      return "warning";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "info";
  }
};

const formatElapsedTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

interface StatusIndicatorProps {
  status: string;
  isRunning?: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, isRunning }) => {
  if (status === "running") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "success.main",
            animation: "pulse 1.5s infinite"
          }}
        />
        <Chip label="Running" size="small" color="success" variant="filled" />
      </Box>
    );
  }

  if (status === "waiting") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "warning.main"
          }}
        />
        <Chip label="Waiting" size="small" color="warning" variant="filled" />
      </Box>
    );
  }

  return (
    <Chip
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      size="small"
      color={getStatusColor(status)}
      variant="filled"
    />
  );
};

interface FleetTableProps {
  runs: RunSummary[];
  onViewRun: (id: string) => void;
  onCancelRun: (id: string) => Promise<void>;
  onApproveRun: (approvalId: string) => Promise<void>;
  isLoading?: boolean;
}

const FleetTable: React.FC<FleetTableProps> = ({
  runs,
  onViewRun,
  onCancelRun,
  onApproveRun,
  isLoading
}) => {
  const [cancelingRunId, setCancelingRunId] = useState<string | null>(null);
  const [approvingApprovalId, setApprovingApprovalId] = useState<string | null>(null);

  const handleCancel = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelingRunId(runId);
    try {
      await onCancelRun(runId);
    } finally {
      setCancelingRunId(null);
    }
  };

  const handleApprove = async (approvalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setApprovingApprovalId(approvalId);
    try {
      await onApproveRun(approvalId);
    } finally {
      setApprovingApprovalId(null);
    }
  };

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "action.hover" }}>
            <TableCell>Definition</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Current Step</TableCell>
            <TableCell>Elapsed</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!isLoading && runs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                <Typography color="textSecondary">No active workflow runs</Typography>
              </TableCell>
            </TableRow>
          )}
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                <CircularProgress size={40} />
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            runs.map((run) => (
              <TableRow
                key={run.id}
                sx={{
                  "&:hover": { backgroundColor: "action.hover" },
                  cursor: "pointer",
                  backgroundColor: run.isStalled ? "rgba(255, 152, 0, 0.1)" : "transparent"
                }}
                onClick={() => {
                  onViewRun(run.id);
                }}
              >
                <TableCell>{run.definitionName}</TableCell>
                <TableCell>
                  <StatusIndicator status={run.status} />
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                  {run.currentStep ?? "-"}
                </TableCell>
                <TableCell sx={{ fontSize: "0.875rem" }}>
                  {formatElapsedTime(run.elapsedMs)}
                  {run.isStalled && (
                    <Typography variant="caption" display="block" color="error" sx={{ mt: 0.5 }}>
                      Stalled (5+ min waiting)
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    {run.pendingApprovalId && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={(e) => {
                          handleApprove(run.pendingApprovalId as string, e);
                        }}
                        disabled={approvingApprovalId === run.pendingApprovalId}
                      >
                        {approvingApprovalId === run.pendingApprovalId ? "..." : "Approve"}
                      </Button>
                    )}
                    {(run.status === "running" || run.status === "waiting") && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={(e) => {
                          handleCancel(run.id, e);
                        }}
                        disabled={cancelingRunId === run.id}
                      >
                        {cancelingRunId === run.id ? "..." : "Cancel"}
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewRun(run.id);
                      }}
                    >
                      View
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

interface StatusCountsProps {
  counts: FleetDashboardData["counts"];
}

const StatusCounts: React.FC<StatusCountsProps> = ({ counts }) => {
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
      <Paper sx={{ p: 2, flex: 1 }}>
        <Typography variant="h6" color="success.main">
          {counts.running}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Running
        </Typography>
      </Paper>
      <Paper sx={{ p: 2, flex: 1 }}>
        <Typography variant="h6" color="warning.main">
          {counts.waiting}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Waiting
        </Typography>
      </Paper>
      <Paper sx={{ p: 2, flex: 1 }}>
        <Typography variant="h6" color="error.main">
          {counts.failed}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Failed
        </Typography>
      </Paper>
      <Paper sx={{ p: 2, flex: 1 }}>
        <Typography variant="h6" color="info.main">
          {counts.completed}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Completed
        </Typography>
      </Paper>
    </Stack>
  );
};

export const FleetDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<FleetDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "waiting" | "failed" | "completed">("all");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboard = async (): Promise<void> => {
    try {
      setError(null);
      const data = await getFleetDashboard();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch fleet dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();

    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      void fetchDashboard();
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleCancelRun = async (runId: string): Promise<void> => {
    try {
      await cancelWorkflowRun(runId);
      await fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel run");
    }
  };

  const handleApproveRun = async (approvalId: string): Promise<void> => {
    try {
      await approveWorkflowRun(approvalId);
      await fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve run");
    }
  };

  const getFilteredRuns = (): RunSummary[] => {
    if (!dashboardData) return [];

    const allRuns = [...dashboardData.activeRuns, ...dashboardData.recentRuns];

    switch (statusFilter) {
      case "active":
        return allRuns.filter((r) => r.status === "running");
      case "waiting":
        return allRuns.filter((r) => r.status === "waiting");
      case "failed":
        return allRuns.filter((r) => r.status === "failed");
      case "completed":
        return allRuns.filter((r) => r.status === "completed");
      case "all":
      default:
        return allRuns;
    }
  };

  const filteredRuns = getFilteredRuns();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Typography variant="h4">Fleet Dashboard</Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => {
            void fetchDashboard();
          }}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && dashboardData && (
        <>
          <StatusCounts counts={dashboardData.counts} />

          <Tabs
            value={statusFilter}
            onChange={(e, newValue) => {
              setStatusFilter(newValue);
            }}
            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="All" value="all" />
            <Tab label="Active" value="active" />
            <Tab label="Waiting" value="waiting" />
            <Tab label="Failed" value="failed" />
            <Tab label="Completed" value="completed" />
          </Tabs>

          <FleetTable
            runs={filteredRuns}
            onViewRun={(id) => {
              navigate(`/runs/${id}`);
            }}
            onCancelRun={handleCancelRun}
            onApproveRun={handleApproveRun}
            isLoading={loading}
          />
        </>
      )}

      {loading && !dashboardData && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}
    </Container>
  );
};
