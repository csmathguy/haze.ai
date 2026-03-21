/* eslint-disable max-lines-per-function, @typescript-eslint/no-confusing-void-expression */
import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { styled } from "@mui/material/styles";
import type { CreateKnowledgeEntryDraftInput, KnowledgeEntry, KnowledgeSubject } from "@taxes/shared";

import { buildEntryInput } from "../model.js";
import { KnowledgeMarkdown } from "./KnowledgeMarkdown.js";

type DrawerMode = "create" | "detail";

export function KnowledgeDrawer({
  entry,
  isOpen,
  mode,
  onClose,
  onCreateEntry,
  onModeChange,
  relatedEntries,
  subjects
}: {
  readonly entry: KnowledgeEntry | null;
  readonly isOpen: boolean;
  readonly mode: DrawerMode | null;
  readonly onClose: () => void;
  readonly onCreateEntry: (input: CreateKnowledgeEntryDraftInput) => Promise<void>;
  readonly onModeChange: (mode: DrawerMode) => void;
  readonly relatedEntries: KnowledgeEntry[];
  readonly subjects: KnowledgeSubject[];
}) {
  return (
    <Drawer
      anchor="right"
      open={isOpen}
      slotProps={{ paper: { sx: { borderLeft: "1px solid var(--mui-palette-divider)", width: { lg: 780, xs: "100vw" } } } }}
      variant="persistent"
    >
      <DrawerHeader mode={mode} onClose={onClose} onModeChange={onModeChange} />
      <Divider />
      <Box sx={{ overflow: "auto", p: 2.5 }}>
        <DrawerBody mode={mode} entry={entry} onCreateEntry={onCreateEntry} relatedEntries={relatedEntries} subjects={subjects} />
      </Box>
    </Drawer>
  );
}

function DrawerBody({
  entry,
  mode,
  onCreateEntry,
  relatedEntries,
  subjects
}: {
  readonly entry: KnowledgeEntry | null;
  readonly mode: DrawerMode | null;
  readonly onCreateEntry: (input: CreateKnowledgeEntryDraftInput) => Promise<void>;
  readonly relatedEntries: KnowledgeEntry[];
  readonly subjects: KnowledgeSubject[];
}) {
  if (mode === "create") {
    return <CreateEntryForm onCreateEntry={onCreateEntry} subjects={subjects} />;
  }

  if (entry === null) {
    return (
      <Typography color="text.secondary" variant="body2">
        Select an entry to inspect its rendered content.
      </Typography>
    );
  }

  return <EntryDetail entry={entry} relatedEntries={relatedEntries} />;
}

function DrawerHeader({
  mode,
  onClose,
  onModeChange
}: {
  readonly mode: DrawerMode | null;
  readonly onClose: () => void;
  readonly onModeChange: (mode: DrawerMode) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" px={2.5} py={1.5} spacing={2}>
      <div>
        <Typography variant="subtitle2">Knowledge drawer</Typography>
        <Typography variant="h3">{mode === "create" ? "Create research" : "Entry detail"}</Typography>
      </div>
      <Stack direction="row" spacing={1}>
        <Button onClick={() => onModeChange("create")} variant={mode === "create" ? "contained" : "outlined"}>
          New Research
        </Button>
        <IconButton aria-label="Close drawer" onClick={onClose}>
          <CloseOutlinedIcon />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function EntryDetail({ entry, relatedEntries }: { readonly entry: KnowledgeEntry; readonly relatedEntries: KnowledgeEntry[] }) {
  const shouldRenderHeader = entry.kind !== "doc-mirror";
  const memory = entry.content.memory;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip color="primary" label={entry.kind} size="small" />
        <Chip label={entry.visibility} size="small" />
        <Chip label={entry.namespace} size="small" />
        {memory === undefined ? (
          <Chip label="memory: none" size="small" variant="outlined" />
        ) : (
          <Chip label={`memory: ${memory.tier}`} size="small" variant="outlined" />
        )}
      </Stack>
      {shouldRenderHeader ? <Typography variant="h2">{entry.title}</Typography> : null}
      <Typography variant="body2">{entry.content.abstract}</Typography>
      <Divider />
      {memory === undefined ? null : (
        <Stack spacing={1}>
          <Typography variant="subtitle2">Memory metadata</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip label={`source: ${memory.sourceType}`} size="small" variant="outlined" />
            <Chip label={`review: ${memory.reviewState}`} size="small" variant="outlined" />
            <Chip label={`confidence: ${memory.confidence}`} size="small" variant="outlined" />
            <Chip label={`reactivations: ${String(memory.reactivationCount)}`} size="small" variant="outlined" />
            {memory.sharedAcrossAgents ? <Chip label="shared" size="small" variant="outlined" /> : <Chip label="scoped" size="small" variant="outlined" />}
          </Stack>
        </Stack>
      )}
      {entry.content.markdown === undefined ? null : <KnowledgeMarkdown content={entry.content.markdown} />}
      {entry.content.json === undefined ? null : (
        <Pre>{JSON.stringify(entry.content.json, null, 2)}</Pre>
      )}
      <Divider />
      <Stack spacing={1}>
        <Typography variant="subtitle2">Related memories</Typography>
        {relatedEntries.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No related memories found.
          </Typography>
        ) : (
          relatedEntries.map((relatedEntry) => (
            <Paper key={relatedEntry.id} sx={{ p: 1.25 }} variant="outlined">
              <Stack spacing={0.5}>
                <Typography variant="body2">{relatedEntry.title}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {relatedEntry.namespace} · {relatedEntry.kind}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {relatedEntry.content.abstract}
                </Typography>
              </Stack>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}

function CreateEntryForm({
  onCreateEntry,
  subjects
}: {
  readonly onCreateEntry: (input: CreateKnowledgeEntryDraftInput) => Promise<void>;
  readonly subjects: KnowledgeSubject[];
}) {
  const [formState, setFormState] = useState({
    abstract: "",
    importance: "medium",
    jsonText: "",
    kind: "agent-memory",
    markdown: "",
    namespace: "knowledge:research",
    subjectId: "",
    tags: "",
    title: "",
    visibility: "shared"
  });

  async function handleSubmit(): Promise<void> {
    await onCreateEntry(buildEntryInput(formState));
    setFormState({
      abstract: "",
      importance: "medium",
      jsonText: "",
      kind: "agent-memory",
      markdown: "",
      namespace: "knowledge:research",
      subjectId: "",
      tags: "",
      title: "",
      visibility: "shared"
    });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h2">New research</Typography>
      <TextField label="Title" onChange={(event) => setFormState({ ...formState, title: event.target.value })} value={formState.title} />
      <TextField label="Kind" onChange={(event) => setFormState({ ...formState, kind: event.target.value })} select value={formState.kind}>
        {["agent-memory", "research-report", "technical-note", "profile-note", "follow-up", "process-note"].map((kind) => (
          <MenuItem key={kind} value={kind}>
            {kind}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Subject" onChange={(event) => setFormState({ ...formState, subjectId: event.target.value })} select value={formState.subjectId}>
        <MenuItem value="">None</MenuItem>
        {subjects.map((subject) => (
          <MenuItem key={subject.id} value={subject.id}>
            {subject.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField label="Namespace" onChange={(event) => setFormState({ ...formState, namespace: event.target.value })} value={formState.namespace} />
      <TextField label="Abstract" minRows={2} multiline onChange={(event) => setFormState({ ...formState, abstract: event.target.value })} value={formState.abstract} />
      <TextField
        label="Markdown"
        minRows={8}
        multiline
        onChange={(event) => setFormState({ ...formState, markdown: event.target.value })}
        value={formState.markdown}
      />
      <TextField label="Optional JSON payload" minRows={4} multiline onChange={(event) => setFormState({ ...formState, jsonText: event.target.value })} value={formState.jsonText} />
      <TextField label="Tags" onChange={(event) => setFormState({ ...formState, tags: event.target.value })} value={formState.tags} />
      <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
        <TextField label="Visibility" onChange={(event) => setFormState({ ...formState, visibility: event.target.value })} select value={formState.visibility}>
          {["shared", "agent", "human"].map((visibility) => (
            <MenuItem key={visibility} value={visibility}>
              {visibility}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Importance" onChange={(event) => setFormState({ ...formState, importance: event.target.value })} select value={formState.importance}>
          {["critical", "high", "medium", "low"].map((importance) => (
            <MenuItem key={importance} value={importance}>
              {importance}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Button disabled={formState.title.trim().length === 0 || formState.abstract.trim().length === 0} onClick={() => void handleSubmit()} variant="contained">
        Save Research
      </Button>
    </Stack>
  );
}

const Pre = styled("pre")(({ theme }) => ({
  backgroundColor: "var(--mui-palette-background-default)",
  borderRadius: Number(theme.shape.borderRadius) * 0.85,
  margin: 0,
  overflowX: "auto",
  padding: theme.spacing(1.5),
  whiteSpace: "pre-wrap"
}));
