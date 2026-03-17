import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
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
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";

import { fetchPendingApprovals, type WorkflowApproval } from "../api.js";

export function PendingApprovals() {
  const [approvals, setApprovals] = useState<WorkflowApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadApprovals();
  }, []);

  async function loadApprovals(): Promise<void> {
    setIsLoading(true);
    const apprvls = await fetchPendingApprovals();
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

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h2">Pending Approvals</Typography>
        <Typography variant="body1">
          Human-approval gates that are currently waiting for action. Approvals block workflow execution until resolved.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardHeader avatar={<ChecklistOutlinedIcon />} title="Approval Gates" />
        <CardContent>
          {approvals.length === 0 ? (
            <Alert severity="success">No pending approvals. All workflows are proceeding unblocked.</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Run ID</TableCell>
                    <TableCell>Node Name</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell align="right">Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {approvals.map((approval) => (
                    <TableRow hover key={approval.id} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                          {approval.runId.slice(0, 12)}…
                        </Typography>
                      </TableCell>
                      <TableCell>{approval.nodeName}</TableCell>
                      <TableCell>
                        <Typography color="textSecondary" variant="body2">
                          {approval.message ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">{new Date(approval.createdAt).toLocaleDateString()}</Typography>
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
