import { useState } from "react";
import { Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { CreateKnowledgeSubjectDraftInput, KnowledgeSubject } from "@taxes/shared";

import { emptyToUndefined } from "../model.js";

const subjectKinds = ["human", "technology", "library", "workflow", "project", "concept"] as const;

export function SubjectsPanel({
  isBusy,
  onCreate,
  selectedSubjectId,
  setSelectedSubjectId,
  subjects
}: {
  readonly isBusy: boolean;
  readonly onCreate: (input: CreateKnowledgeSubjectDraftInput) => Promise<void>;
  readonly selectedSubjectId: string;
  readonly setSelectedSubjectId: (value: string) => void;
  readonly subjects: KnowledgeSubject[];
}) {
  const [formState, setFormState] = useState({
    kind: "human",
    name: "",
    namespace: "human:primary",
    summary: ""
  });

  async function handleSubmit(): Promise<void> {
    await onCreate({
      kind: formState.kind as CreateKnowledgeSubjectDraftInput["kind"],
      name: formState.name,
      namespace: formState.namespace,
      summary: emptyToUndefined(formState.summary)
    });
    setFormState({ kind: "human", name: "", namespace: "human:primary", summary: "" });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h2">Subjects</Typography>
      <TextField label="Focus subject" onChange={(event) => { setSelectedSubjectId(event.target.value); }} select value={selectedSubjectId}>
        <MenuItem value="all">All subjects</MenuItem>
        {subjects.map((subject) => (
          <MenuItem key={subject.id} value={subject.id}>
            {subject.name}
          </MenuItem>
        ))}
      </TextField>
      <SubjectList isBusy={isBusy} subjects={subjects} />
      <SubjectForm formState={formState} onChange={setFormState} onSubmit={() => void handleSubmit()} />
    </Stack>
  );
}

function SubjectList({ isBusy, subjects }: { readonly isBusy: boolean; readonly subjects: KnowledgeSubject[] }) {
  return (
    <Stack spacing={1}>
      {subjects.length === 0 && !isBusy ? <Typography variant="body2">No subjects yet.</Typography> : null}
      {subjects.map((subject) => (
        <Paper key={subject.id} sx={{ p: 1.5 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip color={subject.isPrimaryHuman ? "secondary" : "default"} label={subject.kind} size="small" />
              <Chip label={subject.namespace} size="small" />
            </Stack>
            <Typography variant="h3">{subject.name}</Typography>
            <Typography variant="body2">{subject.summary ?? "No summary yet."}</Typography>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function SubjectForm({
  formState,
  onChange,
  onSubmit
}: {
  readonly formState: { kind: string; name: string; namespace: string; summary: string };
  readonly onChange: (value: { kind: string; name: string; namespace: string; summary: string }) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h3">Add subject</Typography>
      <TextField label="Name" onChange={(event) => { onChange({ ...formState, name: event.target.value }); }} value={formState.name} />
      <TextField label="Kind" onChange={(event) => { onChange({ ...formState, kind: event.target.value }); }} select value={formState.kind}>
        {subjectKinds.map((kind) => (
          <MenuItem key={kind} value={kind}>
            {kind}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Namespace" onChange={(event) => { onChange({ ...formState, namespace: event.target.value }); }} value={formState.namespace} />
      <TextField
        label="Summary"
        minRows={3}
        multiline
        onChange={(event) => { onChange({ ...formState, summary: event.target.value }); }}
        value={formState.summary}
      />
      <Button disabled={formState.name.trim().length === 0 || formState.namespace.trim().length === 0} onClick={onSubmit} variant="contained">
        Save Subject
      </Button>
    </Stack>
  );
}
