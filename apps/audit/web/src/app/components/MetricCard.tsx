import type { ReactNode } from "react";
import { Paper, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

interface MetricCardProps {
  readonly caption: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}

const Card = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: Number(theme.shape.borderRadius) * 1.1,
  padding: theme.spacing(2.5),
  position: "relative"
}));

const IconWrap = styled("span")(() => ({
  alignItems: "center",
  backgroundColor: "color-mix(in srgb, var(--mui-palette-secondary-main) 12%, white)",
  borderRadius: 999,
  color: "var(--mui-palette-primary-main)",
  display: "inline-flex",
  height: 38,
  justifyContent: "center",
  width: 38
}));

export function MetricCard({ caption, icon, label, value }: MetricCardProps) {
  return (
    <Card elevation={0}>
      <Stack spacing={1.5}>
        <Stack alignItems="center" direction="row" justifyContent="space-between">
          <Typography color="text.secondary" variant="subtitle2">
            {label}
          </Typography>
          <IconWrap>{icon}</IconWrap>
        </Stack>
        <Typography variant="h2">{value}</Typography>
        <Typography color="text.secondary" variant="body2">
          {caption}
        </Typography>
      </Stack>
    </Card>
  );
}
