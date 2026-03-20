import React, { useEffect, useState, useRef } from "react";
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

function getStepRunChip(stepRun: WorkflowStepRun): { label: string; color: "error" | "success" | "info" } {
  if (stepRun.errorJson) return { label: "Failed", color: "error" };
  if (stepRun.completedAt) return { label: "Completed", color: "success" };
  return { label: "In Progress", color: "info" };
}

interface StepTimelineProps {
  stepRuns: WorkflowRun["stepRuns"];
}

const StepTimeline: React.FC<StepTimelineProps> = ({ stepRuns }) => {
  if (!stepRuns || stepRuns.length === 0) return null;

  const sortedRuns = [...stepRuns].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  return (
    <>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Step Timeline
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: "action.hover" }}>
              <TableCell>Step ID</TableCell>
              <TableCell>Step Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Started At</TableCell>
              <TableCell>Completed At</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Retries</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRuns.map((stepRun) => {
              const chip = getStepRunChip(stepRun);
              const durationMs = stepRun.completedAt
                ? new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()
                : null;
              return (
                <TableRow key={stepRun.id}>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                    {stepRun.stepId}
                  </TableCell>
                  <TableCell>{stepRun.stepType}</TableCell>
                  <TableCell>
                    <Chip label={chip.label} size="small" color={chip.color} variant="filled" />
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem" }}>{formatDate(stepRun.startedAt)}</TableCell>
                  <TableCell sx={{ fontSize: "0.875rem" }}>
                    {stepRun.completedAt ? formatDate(stepRun.completedAt) : "-"}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem" }}>
                    {durationMs !== null ? `${String(durationMs)}ms` : "-"}
                  </TableCell>
                  <TableCell>{stepRun.retryCount}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

const useFetchWorkflowRun = (id: string | undefined) => {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchRun = async (): Promise<void> => {
      try {
        const data = await getWorkflowRun(id);
        setRun(data);

        const isTerminal = ["completed", "failed", "cancelled"].includes(data.status);
        if (isTerminal && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch run");
      } finally {
        setLoading(false);
      }
    };

    void fetchRun();

    pollingRef.current = setInterval(() => {
      void fetchRun();
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [id]);

  return { run, loading, error };
};

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
      <Box>
        <Typography variant="overline" color="textSecondary">Version</Typography>
        <Typography variant="body2">{run.version}</Typography>
      </Box>
      <Box>
        <Typography variant="overline" color="textSecondary">Current Step</Typography>
        <Typography variant="body2">{run.currentStep ?? "-"}</Typography>
      </Box>
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

export const WorkflowRunDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { run, loading, error } = useFetchWorkflowRun(id);
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);

  useEffect(() => {
    if (!run) return;
    const loadDefinition = async (): Promise<void> => {
      try {
        const def = await getWorkflowDefinition(run.definitionName);
        setDefinition(def);
      } catch {
        // Definition fetch failed, can still show the run
      }
    };
    void loadDefinition();
  }, [run]);

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
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => { navigate("/runs"); }}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Alert severity="error">{error ?? "Run not found"}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => { navigate("/runs"); }}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Typography variant="h4">Run Details</Typography>
          <Chip label={run.status} color={getStatusColor(run.status)} variant="filled" />
        </Box>

        <RunMetadataPanel run={run} />

        {definition && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>Workflow Graph with Run Overlay</Typography>
            <Paper sx={{ p: 2, mb: 4, height: 600 }}>
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
