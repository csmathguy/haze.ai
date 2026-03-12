import { Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { WorkspaceSnapshot } from "@taxes/shared";

import { PanelCard } from "./PanelCard.js";

interface DocumentLedgerProps {
  readonly documents: WorkspaceSnapshot["documents"];
}

export function DocumentLedger({ documents }: DocumentLedgerProps) {
  return (
    <PanelCard>
      <Stack spacing={2}>
        <Typography variant="h5">Document ledger</Typography>
        {documents.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No documents imported yet. Uploading a W-2, 1099-INT, brokerage statement, or crypto export will create the first review tasks.
          </Typography>
        ) : (
          documents.map((document) => (
            <Stack
              direction={{ sm: "row", xs: "column" }}
              key={document.id}
              spacing={1}
              sx={(theme) => ({
                alignItems: { sm: "center", xs: "flex-start" },
                borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                pt: 2
              })}
            >
              <Stack flex={1} spacing={0.5}>
                <Typography variant="subtitle1">{document.fileName}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {document.mimeType} | {Math.ceil(document.fileSizeBytes / 1024)} KB | tax year {document.taxYear}
                </Typography>
              </Stack>
              <Chip label={document.kind} size="small" />
              <Chip color={document.status === "needs-review" ? "warning" : "success"} label={document.status} size="small" />
            </Stack>
          ))
        )}
      </Stack>
    </PanelCard>
  );
}
