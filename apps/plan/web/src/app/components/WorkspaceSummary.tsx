import { Grid, Paper, Stack, Typography } from "@mui/material";
import type { PlanningWorkspace } from "@taxes/shared";

interface WorkspaceSummaryProps {
  readonly workspace: PlanningWorkspace;
}

export function WorkspaceSummary({ workspace }: WorkspaceSummaryProps) {
  const cards = [
    ["Total items", workspace.summary.totalItems.toString()],
    ["Ready now", workspace.summary.readyItems.toString()],
    ["In progress", workspace.summary.activeItems.toString()],
    ["Blocked", workspace.summary.blockedItems.toString()]
  ] as const;

  return (
    <Grid container spacing={2}>
      {cards.map(([label, value]) => (
        <Grid key={label} size={{ md: 3, xs: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={0.5}>
              <Typography color="text.secondary" variant="body2">
                {label}
              </Typography>
              <Typography variant="h2">{value}</Typography>
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}
