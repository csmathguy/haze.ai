import { BarChart } from "@mui/x-charts/BarChart";
import { Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { WorkspaceSnapshot } from "@taxes/shared";

import { buildScenarioChartData, formatScenarioTax } from "../index.js";
import { PanelCard } from "./PanelCard.js";

interface ScenarioPanelProps {
  readonly scenarios: WorkspaceSnapshot["scenarios"];
}

export function ScenarioPanel({ scenarios }: ScenarioPanelProps) {
  const chartData = buildScenarioChartData(scenarios);
  const theme = useTheme();

  return (
    <Stack spacing={3}>
      <PanelCard>
        <Stack spacing={2}>
          <Typography variant="h5">Scenario comparison</Typography>
          <Typography color="text.secondary" variant="body2">
            These templates become meaningful after lots, basis, and acquisition dates are reconciled. The chart is ready for future tax-liability projections.
          </Typography>
          <BarChart
            dataset={chartData}
            height={280}
            series={[
              {
                color: theme.palette.primary.main,
                dataKey: "estimatedTax",
                label: "Estimated federal tax"
              }
            ]}
            xAxis={[
              {
                dataKey: "name",
                scaleType: "band"
              }
            ]}
          />
        </Stack>
      </PanelCard>
      <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
        {scenarios.map((scenario) => (
          <PanelCard
            key={scenario.id}
            sx={(currentTheme) => ({
              border: `1px solid ${alpha(currentTheme.palette.primary.main, 0.14)}`,
              flex: 1
            })}
          >
            <Stack spacing={1}>
              <Typography variant="h6">{scenario.name}</Typography>
              <Typography color="text.secondary" variant="body2">
                {scenario.description}
              </Typography>
              <Typography variant="body2">Method: {scenario.lotSelectionMethod}</Typography>
              <Typography variant="body2">Projected tax: {formatScenarioTax(scenario)}</Typography>
            </Stack>
          </PanelCard>
        ))}
      </Stack>
    </Stack>
  );
}
