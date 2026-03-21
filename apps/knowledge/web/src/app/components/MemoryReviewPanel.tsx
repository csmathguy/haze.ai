import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { KnowledgeEntry } from "@taxes/shared";

export function MemoryReviewPanel({
  entries,
  onApprove,
  onReject,
  onRevise
}: {
  readonly entries: KnowledgeEntry[];
  readonly onApprove: (entry: KnowledgeEntry) => void;
  readonly onReject: (entry: KnowledgeEntry) => void;
  readonly onRevise: (entry: KnowledgeEntry) => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h2">Memory review queue</Typography>
        <Typography color="text.secondary" variant="body2">
          Inferred, low-confidence, or needs-review memories stay visible here until they are accepted, rejected, or revised.
        </Typography>
      </Stack>
      {entries.length === 0 ? <EmptyState /> : <ReviewList entries={entries} onApprove={onApprove} onReject={onReject} onRevise={onRevise} />}
    </Stack>
  );
}

function EmptyState() {
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography color="text.secondary" variant="body2">
        No memories currently need review.
      </Typography>
    </Paper>
  );
}

function ReviewList({
  entries,
  onApprove,
  onReject,
  onRevise
}: {
  readonly entries: KnowledgeEntry[];
  readonly onApprove: (entry: KnowledgeEntry) => void;
  readonly onReject: (entry: KnowledgeEntry) => void;
  readonly onRevise: (entry: KnowledgeEntry) => void;
}) {
  return (
    <Stack spacing={1.5}>
      {entries.map((entry) => (
        <ReviewCard key={entry.id} entry={entry} onApprove={onApprove} onReject={onReject} onRevise={onRevise} />
      ))}
    </Stack>
  );
}

function ReviewCard({
  entry,
  onApprove,
  onReject,
  onRevise
}: {
  readonly entry: KnowledgeEntry;
  readonly onApprove: (entry: KnowledgeEntry) => void;
  readonly onReject: (entry: KnowledgeEntry) => void;
  readonly onRevise: (entry: KnowledgeEntry) => void;
}) {
  const memory = entry.content.memory;
  if (memory === undefined) {
    return null;
  }

  return (
    <Paper sx={{ p: 1.5 }} variant="outlined">
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Stack spacing={0.5}>
            <Typography variant="body1">{entry.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {entry.content.abstract}
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.75} justifyContent="flex-end">
            <Chip label={memory.tier} size="small" variant="outlined" />
            <Chip label={memory.reviewState} size="small" variant="outlined" />
            <Chip label={memory.confidence} size="small" variant="outlined" />
            <Chip label={memory.sourceType} size="small" variant="outlined" />
          </Stack>
        </Stack>
        <Typography color="text.secondary" variant="caption">
          {entry.namespace} - {entry.kind}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            onClick={() => {
              onApprove(entry);
            }}
            size="small"
            variant="contained"
          >
            Accept
          </Button>
          <Button
            onClick={() => {
              onReject(entry);
            }}
            size="small"
            variant="outlined"
          >
            Reject
          </Button>
          <Button
            onClick={() => {
              onRevise(entry);
            }}
            size="small"
            variant="text"
          >
            Revise
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
