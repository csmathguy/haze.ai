import { Stack, Typography } from "@mui/material";

import { PanelCard } from "./PanelCard.js";

interface StatCardProps {
  readonly description: string;
  readonly label: string;
  readonly value: string;
}

export function StatCard({ description, label, value }: StatCardProps) {
  return (
    <PanelCard>
      <Stack spacing={1}>
        <Typography color="text.secondary" variant="overline">
          {label}
        </Typography>
        <Typography variant="h4">{value}</Typography>
        <Typography color="text.secondary" variant="body2">
          {description}
        </Typography>
      </Stack>
    </PanelCard>
  );
}
