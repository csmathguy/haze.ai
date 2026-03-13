import { Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { KnowledgeEntry } from "@taxes/shared";

const entryKinds = ["agent-memory", "doc-mirror", "follow-up", "process-note", "profile-note", "research-report", "technical-note"] as const;

export function EntriesPanel({
  entries,
  kindFilter,
  search,
  selectedEntryId,
  selectedSubjectId,
  setKindFilter,
  setSearch,
  setSelectedEntryId
}: {
  readonly entries: KnowledgeEntry[];
  readonly kindFilter: string;
  readonly search: string;
  readonly selectedEntryId: string | null;
  readonly selectedSubjectId: string;
  readonly setKindFilter: (value: string) => void;
  readonly setSearch: (value: string) => void;
  readonly setSelectedEntryId: (value: string) => void;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h2">Entries</Typography>
      <TextField label="Search" onChange={(event) => { setSearch(event.target.value); }} value={search} />
      <TextField label="Kind" onChange={(event) => { setKindFilter(event.target.value); }} select value={kindFilter}>
        <MenuItem value="all">All kinds</MenuItem>
        {entryKinds.map((kind) => (
          <MenuItem key={kind} value={kind}>
            {kind}
          </MenuItem>
        ))}
      </TextField>
      <Typography color="text.secondary" variant="body2">
        {selectedSubjectId === "all" ? "Showing all namespaces." : "Filtered to the selected subject."}
      </Typography>
      <Stack spacing={1}>
        {entries.map((entry) => (
          <Paper key={entry.id} sx={{ p: 1.5 }} variant={entry.id === selectedEntryId ? "elevation" : "outlined"}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip color="primary" label={entry.kind} size="small" />
                <Chip label={entry.visibility} size="small" />
                <Chip label={entry.namespace} size="small" />
              </Stack>
              <Button onClick={() => { setSelectedEntryId(entry.id); }} sx={{ justifyContent: "flex-start", px: 0 }} variant="text">
                {entry.title}
              </Button>
              <Typography variant="body2">{entry.content.abstract}</Typography>
            </Stack>
          </Paper>
        ))}
        {entries.length === 0 ? <Typography variant="body2">No entries match the current filters.</Typography> : null}
      </Stack>
    </Stack>
  );
}
