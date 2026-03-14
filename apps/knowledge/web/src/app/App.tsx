import { useDeferredValue, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import type {
  CreateKnowledgeEntryDraftInput,
  CreateKnowledgeSubjectDraftInput,
  KnowledgeWorkspace
} from "@taxes/shared";

import { createKnowledgeEntry, createKnowledgeSubject, syncRepositoryDocs } from "./api.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { EntriesPanel } from "./components/EntriesPanel.js";
import { SubjectsPanel } from "./components/SubjectsPanel.js";
import { SummaryStrip } from "./components/SummaryStrip.js";
import { filterEntries, refreshWorkspace, runMutation } from "./model.js";

export function App() {
  const controller = useKnowledgeWorkspaceController();

  return (
    <Box
      sx={{
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--mui-palette-secondary-main) 18%, transparent), transparent 28%), radial-gradient(circle at top right, color-mix(in srgb, var(--mui-palette-primary-main) 12%, transparent), transparent 32%), linear-gradient(180deg, var(--mui-palette-background-default) 0%, var(--mui-palette-background-paper) 100%)",
        minHeight: "100vh",
        pb: 5,
        pt: 5
      }}
    >
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Header onRepoSync={controller.handleRepoSync} />
          {controller.successMessage === null ? null : <Alert severity="success">{controller.successMessage}</Alert>}
          {controller.errorMessage === null ? null : <Alert severity="error">{controller.errorMessage}</Alert>}
          <SummaryStrip workspace={controller.workspace} />
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { lg: "1.15fr 1.35fr 1.5fr", xs: "1fr" }
            }}
          >
            <Panel>
              <SubjectsPanel
                isBusy={controller.isBusy}
                onCreate={controller.handleSubjectCreate}
                selectedSubjectId={controller.selectedSubjectId}
                setSelectedSubjectId={controller.setSelectedSubjectId}
                subjects={controller.workspace?.subjects ?? []}
              />
            </Panel>
            <Panel>
              <EntriesPanel
                entries={controller.filteredEntries}
                kindFilter={controller.kindFilter}
                search={controller.search}
                selectedEntryId={controller.selectedEntry?.id ?? null}
                selectedSubjectId={controller.selectedSubjectId}
                setKindFilter={controller.setKindFilter}
                setSearch={controller.setSearch}
                setSelectedEntryId={controller.setSelectedEntryId}
              />
            </Panel>
            <Panel>
              <DetailPanel
                entry={controller.selectedEntry}
                onCreate={controller.handleEntryCreate}
                subjects={controller.workspace?.subjects ?? []}
              />
            </Panel>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

function useKnowledgeWorkspaceController() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<KnowledgeWorkspace | null>(null);
  const deferredSearch = useDeferredValue(search);
  const filteredEntries = filterEntries(workspace?.entries ?? [], selectedSubjectId, kindFilter, deferredSearch);
  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0] ?? null;

  useEffect(() => {
    void refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace);
  }, []);

  useEffect(() => {
    setSelectedEntryId(selectedEntry?.id ?? null);
  }, [selectedEntry?.id]);

  const refresh = async () => refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace);

  return {
    errorMessage,
    filteredEntries,
    handleEntryCreate: async (input: CreateKnowledgeEntryDraftInput) =>
      runKnowledgeMutation({
        action: async () => createKnowledgeEntry(input),
        errorMessage: "Failed to save the knowledge entry.",
        refresh,
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Knowledge entry saved."
      }),
    handleRepoSync: async () =>
      runKnowledgeMutation({
        action: async () => syncRepositoryDocs(),
        errorMessage: "Failed to synchronize repository docs.",
        refresh,
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Repository docs synchronized into knowledge."
      }),
    handleSubjectCreate: async (input: CreateKnowledgeSubjectDraftInput) =>
      runKnowledgeMutation({
        action: async () => createKnowledgeSubject(input),
        errorMessage: "Failed to save the subject.",
        refresh,
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Knowledge subject saved."
      }),
    isBusy,
    kindFilter,
    search,
    selectedEntry,
    selectedSubjectId,
    setKindFilter,
    setSearch,
    setSelectedEntryId,
    setSelectedSubjectId,
    successMessage,
    workspace
  };
}

function Header({ onRepoSync }: { readonly onRepoSync: () => Promise<void> }) {
  return (
    <Stack direction={{ lg: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
      <div>
        <Typography variant="h1">Knowledge Workspace</Typography>
        <Typography maxWidth={860} variant="body1">
          Long-term memory for agents and humans: structured profiles, research notes, workflow memory, and repository-doc mirrors in one local database.
        </Typography>
      </div>
      <Button onClick={() => void onRepoSync()} size="large" variant="contained">
        Sync Repository Docs
      </Button>
    </Stack>
  );
}

function Panel({ children }: { readonly children: ReactNode }) {
  return <Paper sx={{ p: 2.5 }}>{children}</Paper>;
}

async function runKnowledgeMutation(options: {
  readonly action: () => Promise<void>;
  readonly errorMessage: string;
  readonly refresh: () => Promise<void>;
  readonly setErrorMessage: (value: string | null) => void;
  readonly setSuccessMessage: (value: string | null) => void;
  readonly successMessage: string;
}): Promise<void> {
  await runMutation(options);
}
