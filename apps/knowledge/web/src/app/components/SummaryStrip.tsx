import { Paper, Stack, Typography } from "@mui/material";
import type { KnowledgeWorkspace } from "@taxes/shared";

import { buildSummaryCards } from "../model.js";

export function SummaryStrip({ workspace }: { readonly workspace: KnowledgeWorkspace | null }) {
  return (
    <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
      {buildSummaryCards(workspace?.summary).map((item) => (
        <Paper key={item.label} sx={{ display: "flex", flex: 1, flexDirection: "column", gap: 0.5, minWidth: 0, p: 2 }}>
          <Typography color="text.secondary" variant="body2">
            {item.label}
          </Typography>
          <Typography variant="h2">{item.value}</Typography>
          <Typography variant="body2">{item.caption}</Typography>
        </Paper>
      ))}
    </Stack>
  );
}
