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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

import { getWorkflowDefinition, getWorkflowRun, type WorkflowRun, type WorkflowDefinition, type WorkflowStepRun } from "../api.js";
import { WorkflowGraph } from "../../components/WorkflowGraph.js";

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

const getStepRunStatus = (stepRun: WorkflowStepRun): { label: string; color: "error" | "success" | "info" } => {
  if (stepRun.errorJson) return { label: "Failed", color: "error" };
  if (stepRun.completedAt) return { label: "Completed", color: "success" };
  return { label: "Running", color: "info" };
};

// ---------------------------------------------------------------------------
// StdoutBlock
// ---------------------------------------------------------------------------

interface StdoutBlockProps {
  label: string;
  content: string;
  maxHeight?: number;
  color?: string;
  bg?: string;
}

const StdoutBlock: React.FC<StdoutBlockProps> = ({ label, content, maxHeight = 200, color = "grey.100", bg = "grey.900" }) => (
  <Box sx={{ mt: 1 }}>
    <Typography variant="overline" color="textSecondary" sx={{ display: "block", mb: 0.5 }}>
      {label}
    </Typography>
    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: bg, color, maxHeight, overflow: "auto" }}>
      <Typography component="pre" sx={{ fontFamily: "monospace", fontSize: "0.75rem", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {content}
      </Typography>
    </Box>
  </Box>
);

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
  return {
    isActive: !TERMINAL_STATUSES.has(run.status),
    activeStepId: run.currentStep ?? stepId,
    elapsedMs: Date.now() - new Date(run.startedAt).getTime(),
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
// StepTimelineRow
// ---------------------------------------------------------------------------

interface StepTimelineRowProps {
  stepRun: WorkflowStepRun;
}

const getOutputPreview = (stepRun: WorkflowStepRun): string => {
  if (stepRun.stdout) {
    return stepRun.stdout.trim().split("\n").at(-1)?.slice(0, 80) ?? "";
  }
  if (stepRun.errorJson) {
    try {
      const parsed = JSON.parse(stepRun.errorJson) as { message?: string };
      return parsed.message?.slice(0, 80) ?? "error";
    } catch {
      return stepRun.errorJson.slice(0, 80);
    }
  }
  return "-";
};

const StepTimelineRow: React.FC<StepTimelineRowProps> = ({ stepRun }) => {
  const chip = getStepRunStatus(stepRun);
  const durationMs = stepRun.completedAt
    ? new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()
    : null;
  const durationLabel = durationMs !== null ? formatElapsed(durationMs) : "running…";
  const preview = getOutputPreview(stepRun);

  return (
    <TableRow>
      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{stepRun.stepId}</TableCell>
      <TableCell sx={{ fontSize: "0.8rem" }}>{stepRun.stepType}</TableCell>
      <TableCell><Chip label={chip.label} size="small" color={chip.color} variant="filled" /></TableCell>
      <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{durationLabel}</TableCell>
      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary", maxWidth: 300 }}>{preview}</TableCell>
    </TableRow>
  );
};

// ---------------------------------------------------------------------------
// StepTimeline
// ---------------------------------------------------------------------------

interface StepTimelineProps {
  stepRuns: WorkflowRun["stepRuns"];
}

const StepTimeline: React.FC<StepTimelineProps> = ({ stepRuns }) => {
  if (!stepRuns || stepRuns.length === 0) return null;
  const sortedRuns = [...stepRuns].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  return (
    <>
      <Typography variant="h6" sx={{ mb: 2 }}>Step Timeline</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "action.hover" }}>
              <TableCell>Step ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Output Preview</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRuns.map((stepRun) => <StepTimelineRow key={stepRun.id} stepRun={stepRun} />)}
          </TableBody>
        </Table>
      </TableContainer>
    </>
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const WorkflowRunDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { run, loading, error } = useFetchWorkflowRun(id);
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
        <Button startIcon={<ArrowBackIcon />} onClick={() => { navigate("/runs"); }} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="error">{error ?? "Run not found"}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => { navigate("/runs"); }} sx={{ mb: 2 }}>Back</Button>

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Typography variant="h4">Run Details</Typography>
          <Chip label={run.status} color={getStatusColor(run.status)} variant="filled" />
        </Box>

        <RunMetadataPanel run={run} />
        <LiveActivityPanel run={run} />

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

        <StepTimeline stepRuns={run.stepRuns} />
      </Box>
    </Container>
  );
};
