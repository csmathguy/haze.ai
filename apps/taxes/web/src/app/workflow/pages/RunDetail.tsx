import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Stack,
  Typography
} from "@mui/material";
import ReviewsOutlinedIcon from "@mui/icons-material/ReviewsOutlined";

import { fetchWorkflowRun, type WorkflowRunDetail } from "../api.js";
import { getStatusColor } from "../types.js";

interface RunDetailProps {
  readonly id: string;
}

interface MetadataCardProps {
  readonly run: WorkflowRunDetail;
}

function MetadataCard({ run }: MetadataCardProps) {
  return (
    <Card variant="outlined">
      <CardHeader title="Metadata" />
      <CardContent>
        <Stack spacing={2}>
          <Stack>
            <Typography color="textSecondary" variant="caption">
              Created
            </Typography>
            <Typography variant="body2">{new Date(run.createdAt).toLocaleString()}</Typography>
          </Stack>
          <Stack>
            <Typography color="textSecondary" variant="caption">
              Last Updated
            </Typography>
            <Typography variant="body2">{new Date(run.updatedAt).toLocaleString()}</Typography>
          </Stack>
          {run.completedAt && (
            <Stack>
              <Typography color="textSecondary" variant="caption">
                Completed
              </Typography>
              <Typography variant="body2">{new Date(run.completedAt).toLocaleString()}</Typography>
            </Stack>
          )}
          {run.error && (
            <Stack>
              <Typography color="textSecondary" variant="caption">
                Error
              </Typography>
              <Typography color="error" variant="body2" sx={{ fontFamily: "monospace" }}>
                {run.error}
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function RunDetail({ id }: RunDetailProps) {
  const [run, setRun] = useState<WorkflowRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadRun();
  }, [id]);

  async function loadRun(): Promise<void> {
    setIsLoading(true);
    const data = await fetchWorkflowRun(id);
    setRun(data);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" minHeight={400} justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  if (run === null) {
    return (
      <Stack spacing={3}>
        <Alert severity="error">Workflow run "{id}" not found.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h2">Run {id.slice(0, 12)}</Typography>
        <Typography color="textSecondary" variant="body1">
          {run.definitionName}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Chip color={getStatusColor(run.status)} label={run.status} size="medium" variant="outlined" />
      </Stack>

      <Card variant="outlined">
        <CardHeader avatar={<ReviewsOutlinedIcon />} title="Execution History" />
        <CardContent>
          <Alert severity="info">
            Run inspector and node-by-node execution timeline coming soon (PLAN-150). The interactive graph and detailed
            logs will appear here.
          </Alert>
        </CardContent>
      </Card>

      <MetadataCard run={run} />
    </Stack>
  );
}
