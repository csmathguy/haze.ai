import { Suspense, lazy, useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import {
  Box,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";

import type { SaveBitcoinBasisProfileInput, SaveBitcoinLotSelectionInput, WorkspaceSnapshot } from "@taxes/shared";

import {
  fetchBitcoinFilingSummary,
  fetchWorkspaceSnapshot,
  saveBitcoinBasisProfile,
  saveBitcoinLotSelection,
  uploadTaxDocument,
  type BitcoinFilingSummary
} from "./api.js";
import { BitcoinFilingSummaryPanel } from "./components/BitcoinFilingSummaryPanel.js";
import { DocumentLedger } from "./components/DocumentLedger.js";
import { DocumentUploadPanel } from "./components/DocumentUploadPanel.js";
import { FilingReadinessChecklistPanel } from "./components/FilingReadinessChecklistPanel.js";
import { ReviewQueuePanel } from "./components/ReviewQueuePanel.js";
import { StatCard } from "./components/StatCard.js";
import { TransactionLedgerPanel } from "./components/TransactionLedgerPanel.js";
import { WorkspaceAlerts } from "./components/WorkspaceAlerts.js";
import { buildReviewBanner, summarizeFilingReadiness, summarizeRequiredForms } from "./index.js";

type ViewKey = "documents" | "holdings" | "overview" | "scenarios" | "workflow";

const ScenarioPanel = lazy(async () => {
  const module = await import("./components/ScenarioPanel.js");

  return {
    default: module.ScenarioPanel
  };
});

const WorkflowApp = lazy(async () => {
  const module = await import("@taxes/workflow-web");

  return {
    default: module.WorkflowRoutes
  };
});

interface AppState {
  activeView: ViewKey;
  errorMessage: string | null;
  filingSummary: BitcoinFilingSummary | null;
  isBusy: boolean;
  snapshot: WorkspaceSnapshot | null;
  uploadMessage: string | null;
}

interface AppHandlers {
  handleBitcoinBasisSave: (input: SaveBitcoinBasisProfileInput) => Promise<void>;
  handleBitcoinLotSelectionSave: (input: SaveBitcoinLotSelectionInput) => Promise<void>;
  handleUpload: (file: File) => Promise<void>;
  onActiveViewChange: (view: ViewKey) => void;
}

function createAppState(input: AppState): AppState {
  return input;
}

function createAppHandlers(input: AppHandlers): AppHandlers {
  return input;
}

interface WorkspaceStateSetters {
  readonly setActiveView: (value: ViewKey) => void;
  readonly setErrorMessage: (value: string | null) => void;
  readonly setFilingSummary: (value: BitcoinFilingSummary | null) => void;
  readonly setIsBusy: (value: boolean) => void;
  readonly setSnapshot: (value: WorkspaceSnapshot | null) => void;
  readonly setUploadMessage: (value: string | null) => void;
}

async function refreshWorkspaceState(input: {
  setErrorMessage: (value: string | null) => void;
  setFilingSummary: (value: BitcoinFilingSummary | null) => void;
  setIsBusy: (value: boolean) => void;
  setSnapshot: (value: WorkspaceSnapshot | null) => void;
}): Promise<void> {
  input.setIsBusy(true);
  input.setErrorMessage(null);

  try {
    const [nextSnapshot, nextFilingSummary] = await Promise.all([
      fetchWorkspaceSnapshot(),
      fetchBitcoinFilingSummary()
    ]);

    input.setSnapshot(nextSnapshot);
    input.setFilingSummary(nextFilingSummary);
  } catch (error) {
    input.setErrorMessage(error instanceof Error ? error.message : "Failed to load the local workspace.");
  } finally {
    input.setIsBusy(false);
  }
}

async function runWorkspaceMutation(input: {
  errorFallback: string;
  onSuccess: () => Promise<void>;
  setErrorMessage: (value: string | null) => void;
  setUploadMessage: (value: string | null) => void;
  successMessage: string;
}): Promise<void> {
  input.setUploadMessage(null);
  input.setErrorMessage(null);

  try {
    await input.onSuccess();
    input.setUploadMessage(input.successMessage);
  } catch (error) {
    input.setErrorMessage(error instanceof Error ? error.message : input.errorFallback);
  }
}

async function handleUploadAction(file: File, setters: WorkspaceStateSetters): Promise<void> {
  await runWorkspaceMutation({
    errorFallback: "Upload failed.",
    onSuccess: async () => {
      await uploadTaxDocument(file);
      await refreshWorkspaceState(setters);
      setters.setActiveView("documents");
    },
    setErrorMessage: setters.setErrorMessage,
    setUploadMessage: setters.setUploadMessage,
    successMessage: `${file.name} was added to the local intake queue.`
  });
}

async function handleBitcoinBasisSaveAction(
  input: SaveBitcoinBasisProfileInput,
  setters: WorkspaceStateSetters
): Promise<void> {
  await runWorkspaceMutation({
    errorFallback: "BTC basis save failed.",
    onSuccess: async () => {
      await saveBitcoinBasisProfile(input);
      await refreshWorkspaceState(setters);
      setters.setActiveView("holdings");
    },
    setErrorMessage: setters.setErrorMessage,
    setUploadMessage: setters.setUploadMessage,
    successMessage: "BTC basis method was recorded in the local workspace."
  });
}

async function handleBitcoinLotSelectionSaveAction(
  input: SaveBitcoinLotSelectionInput,
  setters: WorkspaceStateSetters
): Promise<void> {
  await runWorkspaceMutation({
    errorFallback: "BTC lot selection save failed.",
    onSuccess: async () => {
      await saveBitcoinLotSelection(input);
      await refreshWorkspaceState(setters);
      setters.setActiveView("holdings");
    },
    setErrorMessage: setters.setErrorMessage,
    setUploadMessage: setters.setUploadMessage,
    successMessage: "BTC lot selection was recorded in the local workspace."
  });
}

function useAppState(): [AppState, AppHandlers] {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filingSummary, setFilingSummary] = useState<BitcoinFilingSummary | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshWorkspaceState({
      setErrorMessage,
      setFilingSummary,
      setIsBusy,
      setSnapshot
    });
  }, []);

  const setters: WorkspaceStateSetters = {
    setActiveView,
    setErrorMessage,
    setFilingSummary,
    setIsBusy,
    setSnapshot,
    setUploadMessage
  };

  return [
    createAppState({
      activeView,
      errorMessage,
      filingSummary,
      isBusy,
      snapshot,
      uploadMessage
    }),
    createAppHandlers({
      handleBitcoinBasisSave: async (input) => handleBitcoinBasisSaveAction(input, setters),
      handleBitcoinLotSelectionSave: async (input) => handleBitcoinLotSelectionSaveAction(input, setters),
      handleUpload: async (file) => handleUploadAction(file, setters),
      onActiveViewChange: setActiveView
    })
  ];
}

export function App() {
  const [state, handlers] = useAppState();
  const banner = buildReviewBanner(state.snapshot);

  return (
    <Box
      sx={(theme) => ({
        background: `radial-gradient(circle at top, ${alpha(theme.palette.secondary.main, 0.12)}, transparent 30%)`,
        minHeight: "100vh",
        py: 5
      })}
    >
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h1">Taxes Workspace</Typography>
            <Typography maxWidth={760} variant="body1">
              A local-only intake and planning desk for tax documents, asset lots, and filing scenarios. Upload source records, find missing data, and prepare the ground for optimized 1040 support.
            </Typography>
          </Stack>
          <WorkspaceAlerts banner={banner} errorMessage={state.errorMessage} uploadMessage={state.uploadMessage} />

          <Tabs
            onChange={(_event: SyntheticEvent, value: ViewKey) => {
              handlers.onActiveViewChange(value);
            }}
            textColor="primary"
            value={state.activeView}
            variant="scrollable"
          >
            <Tab icon={<RuleFolderOutlinedIcon />} iconPosition="start" label="Overview" value="overview" />
            <Tab icon={<DescriptionOutlinedIcon />} iconPosition="start" label="Documents" value="documents" />
            <Tab icon={<AssignmentTurnedInOutlinedIcon />} iconPosition="start" label="Review" value="holdings" />
            <Tab icon={<SavingsOutlinedIcon />} iconPosition="start" label="Scenarios" value="scenarios" />
            <Tab icon={<TimelineOutlinedIcon />} iconPosition="start" label="Workflow" value="workflow" />
          </Tabs>

          {state.isBusy || state.snapshot === null ? (
            <Stack alignItems="center" minHeight={240} justifyContent="center">
              <CircularProgress />
            </Stack>
          ) : (
            <WorkspaceContent
              activeView={state.activeView}
              filingSummary={state.filingSummary}
              onBitcoinBasisSave={handlers.handleBitcoinBasisSave}
              onBitcoinLotSelectionSave={handlers.handleBitcoinLotSelectionSave}
              onUpload={handlers.handleUpload}
              snapshot={state.snapshot}
            />
          )}
        </Stack>
      </Container>
    </Box>
  );
}

interface SnapshotViewProps {
  readonly snapshot: WorkspaceSnapshot;
}

interface ReviewViewProps extends SnapshotViewProps {
  readonly filingSummary: BitcoinFilingSummary | null;
  readonly onBitcoinBasisSave: (input: SaveBitcoinBasisProfileInput) => Promise<void>;
  readonly onBitcoinLotSelectionSave: (input: SaveBitcoinLotSelectionInput) => Promise<void>;
}

interface UploadViewProps extends SnapshotViewProps {
  readonly onUpload: (file: File) => Promise<void>;
}

function OverviewView({ onUpload, snapshot }: UploadViewProps) {
  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <StatCard
            description="Imported files staged for mapping and reconciliation."
            label="Documents"
            value={snapshot.documents.length.toString()}
          />
        </Grid>
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <StatCard
            description="Explicit data gaps that block confident form preparation."
            label="Review queue"
            value={snapshot.reviewQueue.length.toString()}
          />
        </Grid>
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <StatCard
            description="Federal forms currently implied by the imported sources."
            label="Required forms"
            value={summarizeRequiredForms(snapshot)}
          />
        </Grid>
        <Grid size={{ lg: 3, md: 6, xs: 12 }}>
          <StatCard
            description="Federal and state checklist readiness for the current filing year."
            label="Filing readiness"
            value={summarizeFilingReadiness(snapshot)}
          />
        </Grid>
      </Grid>
      <FilingReadinessChecklistPanel checklist={snapshot.filingChecklist} />
      <DocumentUploadPanel disabled={false} onUpload={onUpload} />
      <ReviewQueuePanel reviewQueue={snapshot.reviewQueue.slice(0, 4)} />
    </Stack>
  );
}

function DocumentsView({ onUpload, snapshot }: UploadViewProps) {
  return (
    <Stack spacing={3}>
      <DocumentUploadPanel disabled={false} onUpload={onUpload} />
      <DocumentLedger documents={snapshot.documents} />
    </Stack>
  );
}

function ReviewView({ filingSummary, onBitcoinBasisSave, onBitcoinLotSelectionSave, snapshot }: ReviewViewProps) {
  return (
    <Stack spacing={3}>
      <TransactionLedgerPanel
        bitcoinBasis={snapshot.bitcoinBasis}
        bitcoinDispositions={snapshot.bitcoinDispositions}
        bitcoinLots={snapshot.bitcoinLots}
        bitcoinLotSelections={snapshot.bitcoinLotSelections}
        importSessions={snapshot.importSessions}
        onBitcoinBasisSave={onBitcoinBasisSave}
        onBitcoinLotSelectionSave={onBitcoinLotSelectionSave}
        transactions={snapshot.transactions}
        transferMatches={snapshot.transferMatches}
      />
      {filingSummary === null ? null : <BitcoinFilingSummaryPanel summary={filingSummary} />}
      <ReviewQueuePanel reviewQueue={snapshot.reviewQueue} />
    </Stack>
  );
}

interface WorkspaceContentProps {
  readonly activeView: ViewKey;
  readonly filingSummary: BitcoinFilingSummary | null;
  readonly onBitcoinBasisSave: (input: SaveBitcoinBasisProfileInput) => Promise<void>;
  readonly onBitcoinLotSelectionSave: (input: SaveBitcoinLotSelectionInput) => Promise<void>;
  readonly onUpload: (file: File) => Promise<void>;
  readonly snapshot: WorkspaceSnapshot;
}

function WorkspaceContent({
  activeView,
  filingSummary,
  onBitcoinBasisSave,
  onBitcoinLotSelectionSave,
  onUpload,
  snapshot
}: WorkspaceContentProps) {
  if (activeView === "overview") {
    return <OverviewView onUpload={onUpload} snapshot={snapshot} />;
  }

  if (activeView === "documents") {
    return <DocumentsView onUpload={onUpload} snapshot={snapshot} />;
  }

  if (activeView === "holdings") {
    return (
      <ReviewView
        filingSummary={filingSummary}
        onBitcoinBasisSave={onBitcoinBasisSave}
        onBitcoinLotSelectionSave={onBitcoinLotSelectionSave}
        snapshot={snapshot}
      />
    );
  }

  if (activeView === "workflow") {
    return <WorkflowView />;
  }

  return (
    <Suspense
      fallback={
        <Stack alignItems="center" minHeight={240} justifyContent="center">
          <CircularProgress />
        </Stack>
      }
    >
      <ScenarioPanel scenarios={snapshot.scenarios} />
    </Suspense>
  );
}

function WorkflowView() {
  return (
    <Suspense
      fallback={
        <Stack alignItems="center" minHeight={240} justifyContent="center">
          <CircularProgress />
        </Stack>
      }
    >
      <MemoryRouter initialEntries={["/runs"]}>
        <WorkflowApp />
      </MemoryRouter>
    </Suspense>
  );
}
