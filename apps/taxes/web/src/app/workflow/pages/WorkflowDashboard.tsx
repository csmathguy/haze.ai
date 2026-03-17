import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
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

import {
  fetchPendingApprovals,
  fetchWorkflowDefinitions,
  fetchWorkflowRuns,
  type WorkflowApproval,
  type WorkflowDefinitionSummary,
  type WorkflowRunSummary
} from "../api.js";
import { getStatusColor } from "../types.js";

interface DashboardStatsProps {
  readonly activeRunCount: number;
  readonly approvalsCount: number;
  readonly definitionsCount: number;
  readonly runsCount: number;
}

function DashboardStats({ activeRunCount, approvalsCount, definitionsCount, runsCount }: DashboardStatsProps) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ lg: 3, md: 6, xs: 12 }}>
        <Card variant="outlined">
          <CardContent sx={{ textAlign: "center" }}>
            <Typography color="textSecondary" variant="body2">
              Definitions
            </Typography>
            <Typography variant="h4">{definitionsCount}</Typography>
            <Typography color="textSecondary" variant="caption">
              Workflow templates
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ lg: 3, md: 6, xs: 12 }}>
        <Card variant="outlined">
          <CardContent sx={{ textAlign: "center" }}>
            <Typography color="textSecondary" variant="body2">
              Active Runs
            </Typography>
            <Typography variant="h4">{activeRunCount}</Typography>
            <Typography color="textSecondary" variant="caption">
              Running or pending
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ lg: 3, md: 6, xs: 12 }}>
        <Card variant="outlined">
          <CardContent sx={{ textAlign: "center" }}>
            <Typography color="textSecondary" variant="body2">
              Pending Approvals
            </Typography>
            <Typography variant="h4">{approvalsCount}</Typography>
            <Typography color="textSecondary" variant="caption">
              Awaiting action
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ lg: 3, md: 6, xs: 12 }}>
        <Card variant="outlined">
          <CardContent sx={{ textAlign: "center" }}>
            <Typography color="textSecondary" variant="body2">
              Recent Runs
            </Typography>
            <Typography variant="h4">{runsCount}</Typography>
            <Typography color="textSecondary" variant="caption">
              All-time total
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

interface RecentRunsCardProps {
  readonly runs: WorkflowRunSummary[];
}

function RecentRunsCard({ runs }: RecentRunsCardProps) {
  return (
    <Card variant="outlined">
      <CardHeader avatar={<TimelineOutlinedIcon />} title="Recent Runs" />
      <CardContent>
        {runs.length === 0 ? (
          <Alert severity="info">No workflow runs yet. Start a new workflow from the Definitions page.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Run ID</TableCell>
                  <TableCell>Definition</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                        {run.id.slice(0, 12)}…
                      </Typography>
                    </TableCell>
                    <TableCell>{run.definitionName}</TableCell>
                    <TableCell>
                      <Chip color={getStatusColor(run.status)} label={run.status} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption">{new Date(run.createdAt).toLocaleDateString()}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkflowDashboard() {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionSummary[]>([]);
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [approvals, setApprovals] = useState<WorkflowApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard(): Promise<void> {
    setIsLoading(true);
    const [defns, allRuns, apprvls] = await Promise.all([
      fetchWorkflowDefinitions(),
      fetchWorkflowRuns(),
      fetchPendingApprovals()
    ]);

    setDefinitions(defns);
    setRuns(allRuns);
    setApprovals(apprvls);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" minHeight={400} justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  const recentRuns = runs.slice(0, 5);
  const activeRunCount = runs.filter((r) => r.status === "running" || r.status === "pending").length;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">Workflow Dashboard</Typography>
        <Typography variant="body1">Monitor workflow definitions, active runs, and pending approvals.</Typography>
      </Stack>

      <DashboardStats
        activeRunCount={activeRunCount}
        approvalsCount={approvals.length}
        definitionsCount={definitions.length}
        runsCount={runs.length}
      />

      <RecentRunsCard runs={recentRuns} />
    </Stack>
  );
}
