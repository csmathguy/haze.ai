import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  CircularProgress,
  Alert,
  Typography,
  Button,
  Chip,
  Stack,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Pause as PauseIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon
} from "@mui/icons-material";

import {
  deleteWorkflowRun,
  getWorkflowDefinition,
  getWorkflowRun,
  type WorkflowRun,
  type WorkflowDefinition,
  type WorkflowStepRun
} from "../api.js";
import { WorkflowGraph } from "../../components/WorkflowGraph.js";
import { StdoutBlock, StepTimeline } from "./StepOutputPanel.js";

const ACTIVE_POLL_MS = 2000;
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

const getStatusColor = (status: string): "success" | "warning" | "error" | "info" => {
  switch (status.toLowerCase()) {
    case "completed":
    case "success":
      return "success";
    case "pending":
    case "in-progress":
      return "info";
    case "failed":
    case "error":
      return "error";
    case "cancelled":
      return "warning";
    default:
      return "info";
  }
};

const formatDate = (date: string): string => new Date(date).toLocaleString();

const formatElapsed = (ms: number): string => {
  if (ms < 60_000) return `${String(Math.floor(ms / 1000))}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${String(mins)}m ${String(secs)}s`;
};

// ---------------------------------------------------------------------------
// LiveActivityPanel helpers
// ---------------------------------------------------------------------------

function getLatestStep(stepRuns: WorkflowStepRun[]): WorkflowStepRun | undefined {
  return [...stepRuns].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )[0];
}

function truncateOutput(text: string | null, maxLen: number, fromEnd: boolean): string | null {
  if (!text || text.length <= maxLen) return text;
  return fromEnd ? `…${text.slice(-maxLen)}` : `${text.slice(0, maxLen)}…`;
}

interface StepOutputs {
  stdout: string | null;
  stderr: string | null;
  errorJson: string | null;
}

function getStepOutputs(step: WorkflowStepRun | undefined): StepOutputs {
  return {
    stdout: step?.stdout ?? null,
    stderr: step?.stderr ?? null,
    errorJson: step?.errorJson ?? null
  };
}

interface ActivityState {
  isActive: boolean;
  activeStepId: string;
  elapsedMs: number;
  truncatedStdout: string | null;
  truncatedStderr: string | null;
  truncatedError: string | null;
}

function getActivityState(run: WorkflowRun): ActivityState | null {
  const latestStep = getLatestStep(run.stepRuns ?? []);
  if (!latestStep && !run.currentStep) return null;

  const stepId = latestStep?.stepId ?? "-";
  const outputs = getStepOutputs(latestStep);
  const endTime = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  return {
    isActive: !TERMINAL_STATUSES.has(run.status),
    activeStepId: run.currentStep ?? stepId,
    elapsedMs: endTime - new Date(run.startedAt).getTime(),
    truncatedStdout: truncateOutput(outputs.stdout, 2000, true),
    truncatedStderr: truncateOutput(outputs.stderr, 1000, true),
    truncatedError: truncateOutput(outputs.errorJson, 800, false)
  };
}

// ---------------------------------------------------------------------------
// LiveActivityPanel
// ---------------------------------------------------------------------------

interface LiveActivityPanelProps {
  run: WorkflowRun;
}

const LiveActivityPanel: React.FC<LiveActivityPanelProps> = ({ run }) => {
  const state = getActivityState(run);
  if (!state) return null;
  const { isActive, activeStepId, elapsedMs, truncatedStdout, truncatedStderr, truncatedError } = state;
  const borderSx = isActive ? { border: "1px solid", borderColor: "primary.main" } : {};

  return (
    <Paper sx={{ p: 3, mb: 4, ...borderSx }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h6">Live Activity</Typography>
        {isActive && <CircularProgress size={16} />}
        <Typography variant="body2" color="textSecondary" sx={{ ml: "auto" }}>
          elapsed: {formatElapsed(elapsedMs)}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography variant="overline" color="textSecondary">Current Step</Typography>
        <Chip label={activeStepId} size="small" color={isActive ? "primary" : "default"} variant={isActive ? "filled" : "outlined"} sx={{ fontFamily: "monospace", fontSize: "0.8rem" }} />
        <Chip label={run.status} size="small" color={getStatusColor(run.status)} variant="outlined" />
      </Box>
      {truncatedError && <StdoutBlock label="error" content={truncatedError} bg="error.light" color="error.contrastText" />}
      {truncatedStdout && <StdoutBlock label="stdout" content={truncatedStdout} />}
      {truncatedStderr && !truncatedError && <StdoutBlock label="stderr" content={truncatedStderr} maxHeight={120} bg="grey.800" color="warning.light" />}
    </Paper>
  );
};


// ---------------------------------------------------------------------------
// Polling hook — 2s recursive timeout for active runs
// ---------------------------------------------------------------------------

const useFetchWorkflowRun = (id: string | undefined) => {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchAndSchedule = async (): Promise<void> => {
      try {
        const data = await getWorkflowRun(id);
        if (cancelled) return;
        setRun(data);
        if (!TERMINAL_STATUSES.has(data.status)) {
          timeoutId = setTimeout(() => { void fetchAndSchedule(); }, ACTIVE_POLL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch run");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAndSchedule();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id]);

  return { run, loading, error };
};

const useRunActions = (id: string | undefined) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handlePause = async (): Promise<void> => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/workflow/runs/${id}/pause`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error(`Failed to pause run: ${response.status.toString()}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to pause run");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/workflow/runs/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error(`Failed to cancel run: ${response.status.toString()}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel run");
    } finally {
      setActionLoading(false);
    }
  };

  return { actionLoading, actionError, handlePause, handleCancel };
};

const RunOverflowMenu: React.FC<{
  actionLoading: boolean;
  onDelete: () => Promise<void>;
}> = ({ actionLoading, onDelete }) => {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <IconButton
        aria-label="run actions"
        onClick={(event) => { setAnchorElement(event.currentTarget); }}
        sx={{ ml: "auto" }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorElement}
        open={anchorElement !== null}
        onClose={() => { setAnchorElement(null); }}
      >
        <MenuItem
          onClick={() => {
            setAnchorElement(null);
            setDeleteDialogOpen(true);
          }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Run
        </MenuItem>
      </Menu>
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); }}>
        <DialogTitle>Delete this run?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" variant="body2">
            This permanently removes the run, its step history, and related approvals. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); }}>Cancel</Button>
          <Button
            color="error"
            disabled={actionLoading}
            onClick={() => {
              void onDelete().finally(() => { setDeleteDialogOpen(false); });
            }}
            variant="contained"
          >
            {actionLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

interface RunActionButtonsProps {
  readonly actionLoading: boolean;
  readonly handleCancel: () => Promise<void>;
  readonly handlePause: () => Promise<void>;
  readonly status: string;
}

const RunActionButtons: React.FC<RunActionButtonsProps> = ({ actionLoading, handleCancel, handlePause, status }) => {
  const isActive = status === "running" || status === "pending";
  if (!isActive) return null;

  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<PauseIcon />}
        onClick={() => { void handlePause(); }}
        disabled={actionLoading}
      >
        Pause
      </Button>
      <Button
        variant="outlined"
        size="small"
        color="error"
        startIcon={<CancelIcon />}
        onClick={() => { void handleCancel(); }}
        disabled={actionLoading}
      >
        Cancel
      </Button>
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// RunMetadataPanel
// ---------------------------------------------------------------------------

interface RunMetadataPanelProps {
  run: WorkflowRun;
}

const RunMetadataPanel: React.FC<RunMetadataPanelProps> = ({ run }) => (
  <Paper sx={{ p: 3, mb: 4 }}>
    <Stack spacing={2}>
      <Box>
        <Typography variant="overline" color="textSecondary">Run ID</Typography>
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{run.id}</Typography>
      </Box>
      <Box>
        <Typography variant="overline" color="textSecondary">Definition</Typography>
        <Typography variant="body2">{run.definitionName}</Typography>
      </Box>
      {run.workItemId && (
        <Box>
          <Typography variant="overline" color="textSecondary">Work Item</Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{run.workItemId}</Typography>
        </Box>
      )}
      <Box>
        <Typography variant="overline" color="textSecondary">Started At</Typography>
        <Typography variant="body2">{formatDate(run.startedAt)}</Typography>
      </Box>
      {run.completedAt && (
        <Box>
          <Typography variant="overline" color="textSecondary">Completed At</Typography>
          <Typography variant="body2">{formatDate(run.completedAt)}</Typography>
        </Box>
      )}
    </Stack>
  </Paper>
);

function useDeleteRun(runId: string | undefined, navigate: ReturnType<typeof useNavigate>) {
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    if (!runId) {
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError(null);
      await deleteWorkflowRun(runId);
      navigate("/fleet");
    } catch (deleteRunError) {
      setDeleteError(deleteRunError instanceof Error ? deleteRunError.message : "Failed to delete run");
    } finally {
      setDeleteLoading(false);
    }
  };

  return { deleteError, deleteLoading, handleDelete };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const WorkflowRunDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { run, loading, error } = useFetchWorkflowRun(id);
  const { actionLoading, actionError, handlePause, handleCancel } = useRunActions(id);
  const { deleteError, deleteLoading, handleDelete } = useDeleteRun(id, navigate);
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [loadedDefinitionName, setLoadedDefinitionName] = useState<string | null>(null);

  useEffect(() => {
    if (!run || run.definitionName === loadedDefinitionName) return;
    setLoadedDefinitionName(run.definitionName);
    const loadDefinition = async (): Promise<void> => {
      try {
        setDefinition(await getWorkflowDefinition(run.definitionName));
      } catch {
        // Definition fetch failed, can still show the run without graph
      }
    };
    void loadDefinition();
  }, [run, loadedDefinitionName]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error ?? !run) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => { navigate("/fleet"); }} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="error">{error ?? "Run not found"}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => { navigate("/fleet"); }} sx={{ mb: 2 }}>Back</Button>

      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <Typography variant="h4">Run Details</Typography>
          <Chip label={run.status} color={getStatusColor(run.status)} variant="filled" />
          <RunActionButtons actionLoading={actionLoading} handleCancel={handleCancel} handlePause={handlePause} status={run.status} />
          <RunOverflowMenu
            actionLoading={deleteLoading}
            onDelete={handleDelete}
          />
        </Box>

        <RunMetadataPanel run={run} />
        <LiveActivityPanel run={run} />
        <StepTimeline stepRuns={run.stepRuns} />

        {definition && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>Workflow Graph</Typography>
            <Paper sx={{ p: 2, mb: 4, height: 500 }}>
              <WorkflowGraph
                definition={definition}
                runOverlay={run.stepRuns && run.stepRuns.length > 0 ? { stepRuns: run.stepRuns, runStatus: run.status } : undefined}
              />
            </Paper>
          </>
        )}
      </Box>
    </Container>
  );
};
