import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import type { BitcoinFilingSummary } from "../api.js";

import { PanelCard } from "./PanelCard.js";

interface BitcoinFilingSummaryPanelProps {
  readonly summary: BitcoinFilingSummary;
}

export function BitcoinFilingSummaryPanel({ summary }: BitcoinFilingSummaryPanelProps) {
  const handleDownload = () => {
    const blob = new Blob([summary.csvContent], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = summary.csvFileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <PanelCard>
      <Stack spacing={2}>
        <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography variant="h5">BTC filing summary</Typography>
            <Typography color="text.secondary" variant="body2">
              Review BTC rows that are ready for Form 8949 style filing support and export the local CSV handoff.
            </Typography>
          </Stack>
          <Button onClick={handleDownload} size="small" variant="outlined">
            Download CSV
          </Button>
        </Stack>
        <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
          <Chip label={`${summary.readyRows.length.toString()} ready row(s)`} size="small" variant="outlined" />
          <Chip label={`${summary.blockedRows.length.toString()} blocked row(s)`} size="small" variant="outlined" />
          <Chip label={`Tax year ${summary.taxYear.toString()}`} size="small" variant="outlined" />
        </Stack>
        {summary.warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}
        {summary.readyRows.length === 0 ? (
          <Alert severity="info">No BTC filing rows are ready yet. Finish lot assignment to generate exportable rows.</Alert>
        ) : (
          summary.readyRows.map((row) => (
            <Stack key={`${row.dispositionTransactionId}-${row.lotId}`} spacing={0.5}>
              <Typography variant="subtitle2">
                {row.quantity} BTC | {row.term} | proceeds ${(row.proceeds.amountInCents / 100).toFixed(2)} | basis $
                {(row.costBasis.amountInCents / 100).toFixed(2)} | gain/loss ${(row.gainOrLoss.amountInCents / 100).toFixed(2)}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Acquired {row.acquiredAt.slice(0, 10)} | Disposed {row.disposedAt.slice(0, 10)} | {row.accountLabel} |{" "}
                {row.dispositionTransactionId}
              </Typography>
            </Stack>
          ))
        )}
        {summary.blockedRows.length === 0 ? null : (
          <Stack spacing={1}>
            <Typography variant="subtitle1">Still blocked</Typography>
            {summary.blockedRows.map((row) => (
              <Alert key={row.sourceTransactionId} severity="info">
                {row.sourceTransactionId}: {row.quantity} BTC blocked. {row.reason}
              </Alert>
            ))}
          </Stack>
        )}
      </Stack>
    </PanelCard>
  );
}
