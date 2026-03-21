import React, { useEffect, useState, useRef } from "react";
import {
  Paper,
  Select,
  MenuItem,
  FormControl,
  Stack,
  Chip,
  Typography
} from "@mui/material";

import { listWorkflowRunsByDefinition, getWorkflowRun, type WorkflowRun } from "../app/api.js";

interface RunSelectorProps {
  definitionName: string;
  onRunSelected: (run: WorkflowRun | null) => void;
}

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

interface RunStatusBadgeProps {
  run: WorkflowRun;
}

const RunStatusBadge: React.FC<RunStatusBadgeProps> = ({ run }) => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
    <Chip label={run.status} color={getStatusColor(run.status)} variant="filled" size="small" />
    <Typography variant="caption" color="textSecondary">
      Started: {new Date(run.startedAt).toLocaleString()}
    </Typography>
  </Stack>
);

interface RunListSelectProps {
  runs: WorkflowRun[];
  selectedRunId: string;
  isLoading: boolean;
  onChange: (runId: string) => void;
}

const RunListSelect: React.FC<RunListSelectProps> = ({ runs, selectedRunId, isLoading, onChange }) => (
  <FormControl fullWidth size="small">
    <Select
      value={selectedRunId}
      onChange={(e) => { onChange(e.target.value); }}
      displayEmpty
      disabled={isLoading || runs.length === 0}
    >
      <MenuItem value="">
        {isLoading ? "Loading runs..." : "Select a run to inspect..."}
      </MenuItem>
      {runs.map((run) => (
        <MenuItem key={run.id} value={run.id}>
          {run.id.substring(0, 8)} — {run.status}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

export const RunSelector: React.FC<RunSelectorProps> = ({ definitionName, onRunSelected }) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setRunsLoading(true);
        const data = await listWorkflowRunsByDefinition(definitionName);
        setRuns(data);
      } catch (err) {
        console.error("Failed to fetch runs:", err);
      } finally {
        setRunsLoading(false);
      }
    };

    void fetchRuns();
  }, [definitionName]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      onRunSelected(null);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const fetchAndPoll = async (): Promise<void> => {
      try {
        const run = await getWorkflowRun(selectedRunId);
        setSelectedRun(run);
        onRunSelected(run);

        const isTerminal = ["completed", "failed", "cancelled"].includes(run.status);
        if (isTerminal && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (err) {
        console.error("Failed to fetch run:", err);
      }
    };

    void fetchAndPoll();

    pollingRef.current = setInterval(() => {
      void fetchAndPoll();
    }, 4000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [selectedRunId, onRunSelected]);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Inspect Workflow Run
        </Typography>
        <RunListSelect runs={runs} selectedRunId={selectedRunId} isLoading={runsLoading} onChange={setSelectedRunId} />
        {selectedRun && <RunStatusBadge run={selectedRun} />}
      </Stack>
    </Paper>
  );
};
