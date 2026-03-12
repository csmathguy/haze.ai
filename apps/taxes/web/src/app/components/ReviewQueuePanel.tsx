import { Alert, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { WorkspaceSnapshot } from "@taxes/shared";

import { PanelCard } from "./PanelCard.js";

interface ReviewQueuePanelProps {
  readonly reviewQueue: WorkspaceSnapshot["reviewQueue"];
}

export function ReviewQueuePanel({ reviewQueue }: ReviewQueuePanelProps) {
  return (
    <PanelCard>
      <Stack spacing={2}>
        <Typography variant="h5">Review queue</Typography>
        {reviewQueue.length === 0 ? (
          <Alert severity="info">The review queue is empty. Upload source documents to generate missing-data checkpoints.</Alert>
        ) : (
          reviewQueue.map((task) => (
            <Stack
              direction={{ sm: "row", xs: "column" }}
              key={task.id}
              spacing={1}
              sx={(theme) => ({
                borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                pt: 2
              })}
            >
              <Stack flex={1} spacing={0.5}>
                <Typography variant="subtitle1">{task.title}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {task.reason}
                </Typography>
              </Stack>
              <Chip color={getSeverityColor(task.severity)} label={task.actionLabel} size="small" />
            </Stack>
          ))
        )}
      </Stack>
    </PanelCard>
  );
}

function getSeverityColor(severity: WorkspaceSnapshot["reviewQueue"][number]["severity"]): "default" | "error" | "warning" {
  if (severity === "required") {
    return "error";
  }

  if (severity === "warning") {
    return "warning";
  }

  return "default";
}
