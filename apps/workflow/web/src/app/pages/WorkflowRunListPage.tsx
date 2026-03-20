import React, { useEffect, useState } from "react";
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
  Button
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";

import { listWorkflowRuns, type WorkflowRun } from "../api.js";

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

interface RunsTableProps {
  runs: WorkflowRun[];
  onViewRun: (id: string) => void;
}

const RunsTable: React.FC<RunsTableProps> = ({ runs, onViewRun }) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow sx={{ backgroundColor: "action.hover" }}>
          <TableCell>ID</TableCell>
          <TableCell>Definition</TableCell>
          <TableCell>Version</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Started At</TableCell>
          <TableCell>Completed At</TableCell>
          <TableCell>Action</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {runs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
              <Typography color="textSecondary">No runs found</Typography>
            </TableCell>
          </TableRow>
        ) : (
          runs.map((run) => (
            <TableRow
              key={run.id}
              sx={{ "&:hover": { backgroundColor: "action.hover" }, cursor: "pointer" }}
              onClick={() => { onViewRun(run.id); }}
            >
              <TableCell sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
                {run.id.substring(0, 8)}...
              </TableCell>
              <TableCell>{run.definitionName}</TableCell>
              <TableCell>{run.version}</TableCell>
              <TableCell>
                <Chip
                  label={run.status}
                  size="small"
                  color={getStatusColor(run.status)}
                  variant="filled"
                />
              </TableCell>
              <TableCell sx={{ fontSize: "0.875rem" }}>{formatDate(run.startedAt)}</TableCell>
              <TableCell sx={{ fontSize: "0.875rem" }}>
                {run.completedAt ? formatDate(run.completedAt) : "-"}
              </TableCell>
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </TableContainer>
);

export const WorkflowRunListPage: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRuns = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const data = await listWorkflowRuns(50);
        setRuns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch runs");
      } finally {
        setLoading(false);
      }
    };

    void fetchRuns();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Typography variant="h4">Workflow Runs</Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => { window.location.reload(); }}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <RunsTable runs={runs} onViewRun={(id) => { navigate(`/runs/${id}`); }} />
      )}
    </Container>
  );
};
