import React, { useEffect, useState } from "react";
import {
  Box,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
  Alert,
  Chip,
  Stack
} from "@mui/material";

import { listWorkflowRunsForDefinition, type WorkflowRun } from "../app/api.js";

interface RunSelectorProps {
  definitionName: string;
  selectedRunId: string | null;
  onRunSelected: (runId: string | null) => void;
}

function getRunStatusColor(status: string): "default" | "primary" | "secondary" | "error" | "warning" | "info" | "success" {
  const statusColors: Record<string, "default" | "primary" | "secondary" | "error" | "warning" | "info" | "success"> = {
    "running": "info",
    "completed": "success",
    "failed": "error",
    "pending": "warning"
  };
  return statusColors[status] ?? "default";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

const RunStatusInfo: React.FC<{ run: WorkflowRun }> = ({ run }) => (
  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
    <Chip
      label={run.status}
      size="small"
      color={getRunStatusColor(run.status)}
      variant="outlined"
    />
    <Typography variant="caption" sx={{ alignSelf: "center" }}>
      Started: {formatDate(run.startedAt)}
    </Typography>
    {run.completedAt && (
      <Typography variant="caption" sx={{ alignSelf: "center" }}>
        Completed: {formatDate(run.completedAt)}
      </Typography>
    )}
  </Box>
);

export const RunSelector: React.FC<RunSelectorProps> = ({
  definitionName,
  selectedRunId,
  onRunSelected
}) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const data = await listWorkflowRunsForDefinition(definitionName);
        setRuns(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load runs");
      } finally {
        setLoading(false);
      }
    };

    void fetchRuns();
  }, [definitionName]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2">Loading runs...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">{error}</Alert>
      </Box>
    );
  }

  const selectedRun = selectedRunId ? runs.find((r) => r.id === selectedRunId) : null;

  return (
    <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Select Run to Inspect</Typography>
        <Select
          value={selectedRunId ?? ""}
          onChange={(event) => {
            onRunSelected(event.target.value === "" ? null : event.target.value);
          }}
          size="small"
          fullWidth
        >
          <MenuItem value="">No run selected</MenuItem>
          {runs.map((run) => (
            <MenuItem key={run.id} value={run.id}>
              {run.id.slice(0, 8)} - {run.status} - {formatDate(run.startedAt)}
            </MenuItem>
          ))}
        </Select>

        {selectedRunId && selectedRun && <RunStatusInfo run={selectedRun} />}
      </Stack>
    </Box>
  );
};
