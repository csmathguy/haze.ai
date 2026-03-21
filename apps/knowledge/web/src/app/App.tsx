/* eslint-disable max-lines-per-function */
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import type { CreateKnowledgeEntryDraftInput, CreateKnowledgeSubjectDraftInput, KnowledgeEntry, KnowledgeWorkspace } from "@taxes/shared";

import { createKnowledgeEntry, createKnowledgeSubject, syncRepositoryDocs, updateKnowledgeEntry } from "./api.js";
import { EntriesTable } from "./components/EntriesTable.js";
import { KnowledgeDrawer } from "./components/KnowledgeDrawer.js";
import { MemoryReviewPanel } from "./components/MemoryReviewPanel.js";
import { SubjectsPanel } from "./components/SubjectsPanel.js";
import { SummaryStrip } from "./components/SummaryStrip.js";
import { filterKnowledgeEntries, findMemoryReviewQueue, findRelatedKnowledgeEntries, refreshWorkspace, runMutation } from "./model.js";

type DrawerMode = "create" | "detail" | null;

export function App({
  colorMode,
  onColorModeChange
}: {
  readonly colorMode: "dark" | "light";
  readonly onColorModeChange: (value: "dark" | "light") => void;
}) {
  const controller = useKnowledgeWorkspaceController();
  const handleMemoryApprove = (entry: KnowledgeEntry) => {
    const promise = controller.handleMemoryApprove(entry);
    promise.catch((error: unknown) => {
      console.error(error);
    });
  };
  const handleMemoryReject = (entry: KnowledgeEntry) => {
    const promise = controller.handleMemoryReject(entry);
    promise.catch((error: unknown) => {
      console.error(error);
    });
  };
  const handleMemoryRevise = (entry: KnowledgeEntry) => {
    controller.handleMemoryRevise(entry);
  };

  return (
    <Shell>
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Header
            colorMode={colorMode}
            onColorModeChange={onColorModeChange}
            onCreateResearch={() => {
              controller.openDrawer("create");
            }}
            onRepoSync={async () => {
              await controller.handleRepoSync();
            }}
          />
          {controller.successMessage === null ? null : <Alert severity="success">{controller.successMessage}</Alert>}
          {controller.errorMessage === null ? null : <Alert severity="error">{controller.errorMessage}</Alert>}
          <SummaryStrip workspace={controller.workspace} />
          <Stack direction={{ lg: "row", xs: "column" }} spacing={2}>
            <Box sx={{ minWidth: { lg: 320, xs: "auto" }, width: { lg: 360, xs: "100%" } }}>
              <Stack spacing={2}>
                <Panel>
                  <SubjectsPanel
                    isBusy={controller.isBusy}
                    onCreate={async (input) => {
                      await controller.handleSubjectCreate(input);
                    }}
                    selectedSubjectId={controller.selectedSubjectId}
                    setSelectedSubjectId={controller.setSelectedSubjectId}
                    subjects={controller.workspace?.subjects ?? []}
                  />
                </Panel>
                <Panel>
                  <MemoryReviewPanel
                    entries={controller.reviewQueue}
                    onApprove={handleMemoryApprove}
                    onReject={handleMemoryReject}
                    onRevise={handleMemoryRevise}
                  />
                </Panel>
              </Stack>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Panel>
                <EntriesTable
                  entries={controller.filteredEntries}
                  entryMemorySummary={controller.entryMemorySummary}
                  memoryRoleFilter={controller.memoryRoleFilter}
                  memoryReviewFilter={controller.memoryReviewFilter}
                  memorySourceFilter={controller.memorySourceFilter}
                  memoryTierFilter={controller.memoryTierFilter}
                  kindFilter={controller.kindFilter}
                  onCreateResearch={() => {
                    controller.openDrawer("create");
                  }}
                  onSelectEntry={(entry) => {
                    controller.openDrawer("detail", entry);
                  }}
                  search={controller.search}
                  selectedEntryId={controller.selectedEntry?.id ?? null}
                  selectedSubjectId={controller.selectedSubjectId}
                  setKindFilter={controller.setKindFilter}
                  setMemoryRoleFilter={controller.setMemoryRoleFilter}
                  setMemoryReviewFilter={controller.setMemoryReviewFilter}
                  setMemorySourceFilter={controller.setMemorySourceFilter}
                  setMemoryTierFilter={controller.setMemoryTierFilter}
                  setSearch={controller.setSearch}
                />
              </Panel>
            </Box>
          </Stack>
          <KnowledgeDrawer
            entry={controller.drawerEntry}
            isOpen={controller.drawerMode !== null}
            mode={controller.drawerMode}
            onClose={controller.closeDrawer}
            onCreateEntry={controller.handleEntryCreate}
            onModeChange={controller.setDrawerMode}
            relatedEntries={controller.relatedEntries}
            subjects={controller.workspace?.subjects ?? []}
          />
        </Stack>
      </Container>
    </Shell>
  );
}

function useKnowledgeWorkspaceController() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [kindFilter, setKindFilter] = useState("all");
  const [memoryRoleFilter, setMemoryRoleFilter] = useState("all");
  const [memoryTierFilter, setMemoryTierFilter] = useState("all");
  const [memorySourceFilter, setMemorySourceFilter] = useState("all");
  const [memoryReviewFilter, setMemoryReviewFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<KnowledgeWorkspace | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [drawerEntryId, setDrawerEntryId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);
  const filteredEntries = useMemo(
    () =>
      filterKnowledgeEntries(workspace?.entries ?? [], {
        agentRole: memoryRoleFilter,
        kind: kindFilter,
        reviewState: memoryReviewFilter,
        search: deferredSearch,
        sourceType: memorySourceFilter,
        subjectId: selectedSubjectId,
        tier: memoryTierFilter
      }),
    [deferredSearch, kindFilter, memoryReviewFilter, memoryRoleFilter, memorySourceFilter, memoryTierFilter, selectedSubjectId, workspace?.entries]
  );
  const relatedEntries = useMemo(() => findRelatedKnowledgeEntries(workspace?.entries ?? [], selectedEntryId), [selectedEntryId, workspace?.entries]);
  const reviewQueue = useMemo(() => findMemoryReviewQueue(workspace?.entries ?? []), [workspace?.entries]);
  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedEntryId) ?? null;
  const drawerEntry = workspace?.entries.find((entry) => entry.id === drawerEntryId) ?? null;
  const entryMemorySummary = useMemo(() => summarizeMemoryEntries(filteredEntries), [filteredEntries]);

  useEffect(() => {
    void refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace);
  }, []);

  return {
    closeDrawer: () => {
      setDrawerMode(null);
      setDrawerEntryId(null);
    },
    drawerEntry,
    drawerMode,
    entryMemorySummary,
    errorMessage,
    filteredEntries,
    handleEntryCreate: async (input: CreateKnowledgeEntryDraftInput) =>
      runKnowledgeMutation({
        action: async () => createKnowledgeEntry(input),
        errorMessage: "Failed to save the knowledge entry.",
        refresh: async () => refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace),
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Knowledge entry saved."
      }),
    handleRepoSync: async () =>
      runKnowledgeMutation({
        action: async () => syncRepositoryDocs(),
        errorMessage: "Failed to synchronize repository docs.",
        refresh: async () => refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace),
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Repository docs synchronized into knowledge."
      }),
    handleSubjectCreate: async (input: CreateKnowledgeSubjectDraftInput) =>
      runKnowledgeMutation({
        action: async () => createKnowledgeSubject(input),
        errorMessage: "Failed to save the subject.",
        refresh: async () => refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace),
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Knowledge subject saved."
      }),
    handleMemoryApprove: async (entry: KnowledgeEntry) =>
      runKnowledgeMutation({
        action: async () =>
          updateKnowledgeEntry(entry.id, {
            content: {
              ...entry.content,
              memory: entry.content.memory === undefined
                ? undefined
                : {
                    ...entry.content.memory,
                    lastReactivatedAt: new Date().toISOString(),
                    reviewState: "approved"
                  }
            },
            lastReviewedAt: new Date().toISOString(),
            status: "active"
          }),
        errorMessage: "Failed to approve the memory.",
        refresh: async () => refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace),
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Memory approved."
      }),
    handleMemoryReject: async (entry: KnowledgeEntry) =>
      runKnowledgeMutation({
        action: async () =>
          updateKnowledgeEntry(entry.id, {
            content: {
              ...entry.content,
              memory: entry.content.memory === undefined
                ? undefined
                : {
                    ...entry.content.memory,
                    reviewState: "rejected"
                  }
            },
            lastReviewedAt: new Date().toISOString(),
            status: "archived"
          }),
        errorMessage: "Failed to reject the memory.",
        refresh: async () => refreshWorkspace(setErrorMessage, setIsBusy, setWorkspace),
        setErrorMessage,
        setSuccessMessage,
        successMessage: "Memory rejected."
      }),
    handleMemoryRevise: (entry: KnowledgeEntry) => {
      setSelectedEntryId(entry.id);
      setDrawerMode("detail");
      setDrawerEntryId(entry.id);
    },
    isBusy,
    kindFilter,
    memoryRoleFilter,
    memoryReviewFilter,
    memorySourceFilter,
    memoryTierFilter,
    openDrawer: (mode: Exclude<DrawerMode, null>, entry?: KnowledgeEntry) => {
      setDrawerMode(mode);
      setDrawerEntryId(entry?.id ?? null);
      if (entry !== undefined) {
        setSelectedEntryId(entry.id);
      }
    },
    relatedEntries,
    reviewQueue,
    search,
    selectedEntry,
    selectedSubjectId,
    setDrawerMode,
    setKindFilter,
    setMemoryRoleFilter,
    setMemoryReviewFilter,
    setMemorySourceFilter,
    setMemoryTierFilter,
    setSearch,
    setSelectedEntryId,
    setSelectedSubjectId,
    successMessage,
    workspace
  };
}

function summarizeMemoryEntries(entries: KnowledgeEntry[]) {
  return entries.reduce(
    (summary, entry) => {
      const memory = entry.content.memory;
      if (memory !== undefined) {
        summary.withMemory += 1;
        summary.byTier[memory.tier] += 1;
      }
      return summary;
    },
    {
      byTier: {
        archive: 0,
        "long-term": 0,
        "medium-term": 0,
        "short-term": 0
      },
      withMemory: 0
    }
  );
}

function Header({
  colorMode,
  onColorModeChange,
  onCreateResearch,
  onRepoSync
}: {
  readonly colorMode: "dark" | "light";
  readonly onColorModeChange: (value: "dark" | "light") => void;
  readonly onCreateResearch: () => void;
  readonly onRepoSync: () => Promise<void>;
}) {
  return (
    <Stack direction={{ lg: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
      <div>
        <Typography variant="h1">Knowledge Workspace</Typography>
        <Typography maxWidth={860} variant="body1">
          Long-term memory for agents and humans: structured profiles, research notes, workflow memory, and repository-doc mirrors in one local database.
        </Typography>
      </div>
      <Stack direction="row" spacing={1}>
        <Tooltip title={`Switch to ${colorMode === "dark" ? "light" : "dark"} mode`}>
          <IconButton
            aria-label="toggle color mode"
            onClick={() => {
              onColorModeChange(colorMode === "dark" ? "light" : "dark");
            }}
          >
            {colorMode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
          </IconButton>
        </Tooltip>
        <Button onClick={onCreateResearch} variant="outlined">
          New Research
        </Button>
        <Button onClick={() => void onRepoSync()} size="large" variant="contained">
          Sync Repository Docs
        </Button>
      </Stack>
    </Stack>
  );
}

function Panel({ children }: { readonly children: ReactNode }) {
  return <Paper sx={{ p: 2.5 }}>{children}</Paper>;
}

function Shell({ children }: { readonly children: ReactNode }) {
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
      {children}
    </Box>
  );
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
