import { Chip, Link, Paper, Stack, Typography } from "@mui/material";

import type { ResearchSource } from "@taxes/shared";

interface ResearchPanelProps {
  readonly sources: ResearchSource[];
}

export function ResearchPanel({ sources }: ResearchPanelProps) {
  return (
    <Paper sx={{ p: 3 }} variant="outlined">
      <Stack spacing={1.5}>
        <Typography variant="h2">Research basis</Typography>
        {sources.map((source) => (
          <Stack key={source.id} spacing={0.5}>
            <Link href={source.url} rel="noreferrer" target="_blank" underline="hover">
              {source.title}
            </Link>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip label={`Reviewed ${source.reviewedAt}`} size="small" variant="outlined" />
              <Chip label={source.authority} size="small" variant="outlined" />
            </Stack>
            <Typography variant="body2">{source.note}</Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
