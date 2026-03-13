import { Paper, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { BarChart } from "@mui/x-charts/BarChart";

import type { AuditRunOverview } from "@taxes/shared";

import { formatDuration, formatRelativePath } from "../time.js";

interface RunDurationChartProps {
  readonly runs: AuditRunOverview[];
}

const ChartShell = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: theme.shape.borderRadius,
  minHeight: 280,
  padding: theme.spacing(2.5)
}));

export function RunDurationChart({ runs }: RunDurationChartProps) {
  const recentRuns = runs.slice(0, 8).reverse();

  if (recentRuns.length === 0) {
    return (
      <ChartShell elevation={0}>
        <Typography variant="h3">Run velocity</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
          No audit runs have been written to the shared database yet.
        </Typography>
      </ChartShell>
    );
  }

  return (
    <ChartShell elevation={0}>
      <Stack spacing={2}>
        <div>
          <Typography variant="h3">Run velocity</Typography>
          <Typography color="text.secondary" variant="body2">
            Latest durations across active worktrees.
          </Typography>
        </div>
        <BarChart
          borderRadius={10}
          height={220}
          margin={{ bottom: 50, left: 50, right: 10, top: 10 }}
          series={[
            {
              color: "var(--mui-palette-secondary-main)",
              data: recentRuns.map((run) => Math.max(1, Math.round((run.durationMs ?? 0) / 1000))),
              label: "Seconds"
            }
          ]}
          xAxis={[
            {
              data: recentRuns.map((run) => formatRelativePath(run.worktreePath)),
              scaleType: "band"
            }
          ]}
          yAxis={[
            {
              label: "Duration (s)"
            }
          ]}
        />
        <Typography color="text.secondary" variant="body2">
          Slowest recent run: {formatDuration(Math.max(...recentRuns.map((run) => run.durationMs ?? 0)))}
        </Typography>
      </Stack>
    </ChartShell>
  );
}
