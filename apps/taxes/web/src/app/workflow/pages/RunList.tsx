import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";

import { fetchWorkflowRuns, type WorkflowRunSummary } from "../api.js";
import { getStatusColor } from "../types.js";

export function RunList() {
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadRuns();
  }, []);

  async function loadRuns(): Promise<void> {
    setIsLoading(true);
    const allRuns = await fetchWorkflowRuns();
    setRuns(allRuns);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" minHeight={400} justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h2">Workflow Runs</Typography>
        <Typography variant="body1">
          All recent and active workflow executions. Click a run to inspect its execution history and node details.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardHeader avatar={<TimelineOutlinedIcon />} title="All Runs" />
        <CardContent>
          {runs.length === 0 ? (
            <Alert severity="info">No workflow runs yet. Start a new workflow from the Definitions page.</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Run ID</TableCell>
                    <TableCell>Definition</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Updated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow hover key={run.id} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                          {run.id.slice(0, 16)}…
                        </Typography>
                      </TableCell>
                      <TableCell>{run.definitionName}</TableCell>
                      <TableCell>
                        <Chip color={getStatusColor(run.status)} label={run.status} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{new Date(run.createdAt).toLocaleDateString()}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{new Date(run.updatedAt).toLocaleDateString()}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
