import { useState } from "react";
import { Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { CreateKnowledgeEntryDraftInput, KnowledgeEntry, KnowledgeSubject } from "@taxes/shared";

import { buildEntryInput } from "../model.js";
import { KnowledgeMarkdown } from "./KnowledgeMarkdown.js";

const detailKinds = ["agent-memory", "research-report", "technical-note", "profile-note", "follow-up", "process-note"] as const;
const visibilities = ["shared", "agent", "human"] as const;
const importanceLevels = ["critical", "high", "medium", "low"] as const;
interface EntryFormState {
  abstract: string;
  importance: string;
  jsonText: string;
  kind: string;
  markdown: string;
  namespace: string;
  subjectId: string;
  tags: string;
  title: string;
  visibility: string;
}

export function DetailPanel({
  entry,
  onCreate,
  subjects
}: {
  readonly entry: KnowledgeEntry | null;
  readonly onCreate: (input: CreateKnowledgeEntryDraftInput) => Promise<void>;
  readonly subjects: KnowledgeSubject[];
}) {
  const [formState, setFormState] = useState<EntryFormState>({
    abstract: "",
    importance: "medium",
    jsonText: "",
    kind: "agent-memory",
    markdown: "",
    namespace: "human:primary",
    subjectId: "",
    tags: "",
    title: "",
    visibility: "shared"
  });

  async function handleSubmit(): Promise<void> {
    await onCreate(buildEntryInput(formState));
    setFormState({
      abstract: "",
      importance: "medium",
      jsonText: "",
      kind: "agent-memory",
      markdown: "",
      namespace: "human:primary",
      subjectId: "",
      tags: "",
      title: "",
      visibility: "shared"
    });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h2">Detail</Typography>
      {entry === null ? <Typography variant="body2">Select an entry to inspect its content.</Typography> : <EntryDetail entry={entry} />}
      <EntryComposer formState={formState} onChange={setFormState} onSubmit={() => void handleSubmit()} subjects={subjects} />
    </Stack>
  );
}

function EntryComposer({
  formState,
  onChange,
  onSubmit,
  subjects
}: {
  readonly formState: EntryFormState;
  readonly onChange: (value: EntryFormState) => void;
  readonly onSubmit: () => void;
  readonly subjects: KnowledgeSubject[];
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h3">Add entry</Typography>
      <TextField label="Title" onChange={(event) => { onChange({ ...formState, title: event.target.value }); }} value={formState.title} />
      <TextField label="Kind" onChange={(event) => { onChange({ ...formState, kind: event.target.value }); }} select value={formState.kind}>
        {detailKinds.map((kind) => (
          <MenuItem key={kind} value={kind}>
            {kind}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Subject" onChange={(event) => { onChange({ ...formState, subjectId: event.target.value }); }} select value={formState.subjectId}>
        <MenuItem value="">None</MenuItem>
        {subjects.map((subject) => (
          <MenuItem key={subject.id} value={subject.id}>
            {subject.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Namespace" onChange={(event) => { onChange({ ...formState, namespace: event.target.value }); }} value={formState.namespace} />
      <TextField label="Abstract" minRows={2} multiline onChange={(event) => { onChange({ ...formState, abstract: event.target.value }); }} value={formState.abstract} />
      <TextField label="Markdown" minRows={5} multiline onChange={(event) => { onChange({ ...formState, markdown: event.target.value }); }} value={formState.markdown} />
      <TextField label="Optional JSON payload" minRows={4} multiline onChange={(event) => { onChange({ ...formState, jsonText: event.target.value }); }} value={formState.jsonText} />
      <TextField label="Tags" onChange={(event) => { onChange({ ...formState, tags: event.target.value }); }} value={formState.tags} />
      <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
        <TextField label="Visibility" onChange={(event) => { onChange({ ...formState, visibility: event.target.value }); }} select value={formState.visibility}>
          {visibilities.map((visibility) => (
            <MenuItem key={visibility} value={visibility}>
              {visibility}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Importance" onChange={(event) => { onChange({ ...formState, importance: event.target.value }); }} select value={formState.importance}>
          {importanceLevels.map((importance) => (
            <MenuItem key={importance} value={importance}>
              {importance}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Button disabled={formState.title.trim().length === 0 || formState.abstract.trim().length === 0} onClick={onSubmit} variant="contained">
        Save Entry
      </Button>
    </Stack>
  );
}

function EntryDetail({ entry }: { readonly entry: KnowledgeEntry }) {
  const shouldRenderHeader = entry.kind !== "doc-mirror";

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip color="primary" label={entry.kind} size="small" />
        <Chip label={entry.visibility} size="small" />
        <Chip label={entry.namespace} size="small" />
      </Stack>
      {shouldRenderHeader ? <Typography variant="h3">{entry.title}</Typography> : null}
      <Typography variant="body2">{entry.content.abstract}</Typography>
      {entry.tags.length === 0 ? null : (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {entry.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </Stack>
      )}
      {entry.content.markdown === undefined ? null : (
        <KnowledgeMarkdown content={entry.content.markdown} />
      )}
      {entry.content.json === undefined ? null : (
        <Paper sx={{ p: 1.5 }}>
          <Typography component="pre" sx={{ m: 0, whiteSpace: "pre-wrap" }} variant="body2">
            {JSON.stringify(entry.content.json, null, 2)}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
