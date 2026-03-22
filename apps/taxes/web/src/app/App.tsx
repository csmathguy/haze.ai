import { Suspense, lazy, useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import {
  Alert,
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

import { fetchWorkspaceSnapshot, saveBitcoinBasisProfile, saveBitcoinLotSelection, uploadTaxDocument } from "./api.js";
import { DocumentLedger } from "./components/DocumentLedger.js";
import { DocumentUploadPanel } from "./components/DocumentUploadPanel.js";
import { FilingReadinessChecklistPanel } from "./components/FilingReadinessChecklistPanel.js";
import { ReviewQueuePanel } from "./components/ReviewQueuePanel.js";
import { StatCard } from "./components/StatCard.js";
import { TransactionLedgerPanel } from "./components/TransactionLedgerPanel.js";
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

function useAppState(): [AppState, AppHandlers] {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  async function refreshWorkspace(): Promise<void> {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      setSnapshot(await fetchWorkspaceSnapshot());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the local workspace.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpload(file: File): Promise<void> {
    setUploadMessage(null);
    setErrorMessage(null);

    try {
      await uploadTaxDocument(file);
      setUploadMessage(`${file.name} was added to the local intake queue.`);
      await refreshWorkspace();
      setActiveView("documents");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function handleBitcoinBasisSave(input: SaveBitcoinBasisProfileInput): Promise<void> {
    setUploadMessage(null);
    setErrorMessage(null);

    try {
      await saveBitcoinBasisProfile(input);
      setUploadMessage("BTC basis method was recorded in the local workspace.");
      await refreshWorkspace();
      setActiveView("holdings");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "BTC basis save failed.");
    }
  }

  async function handleBitcoinLotSelectionSave(input: SaveBitcoinLotSelectionInput): Promise<void> {
    setUploadMessage(null);
    setErrorMessage(null);

    try {
      await saveBitcoinLotSelection(input);
      setUploadMessage("BTC lot selection was recorded in the local workspace.");
      await refreshWorkspace();
      setActiveView("holdings");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "BTC lot selection save failed.");
    }
  }

  const state: AppState = {
    activeView,
    errorMessage,
    isBusy,
    snapshot,
    uploadMessage
  };

  const handlers: AppHandlers = {
    handleBitcoinBasisSave,
    handleBitcoinLotSelectionSave,
    handleUpload,
    onActiveViewChange: setActiveView
  };

  return [state, handlers];
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

function ReviewView({ onBitcoinBasisSave, onBitcoinLotSelectionSave, snapshot }: ReviewViewProps) {
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
      <ReviewQueuePanel reviewQueue={snapshot.reviewQueue} />
      <Alert severity="info">
        Asset-lot tracking is still empty. The next slices will load normalized transactions into lots, transfer matching, and basis reconciliation.
      </Alert>
    </Stack>
  );
}

interface WorkspaceAlertsProps {
  readonly banner: ReturnType<typeof buildReviewBanner>;
  readonly errorMessage: string | null;
  readonly uploadMessage: string | null;
}

function WorkspaceAlerts({ banner, errorMessage, uploadMessage }: WorkspaceAlertsProps) {
  return (
    <>
      {banner !== null ? <Alert severity={banner.emphasis}>{banner.message}</Alert> : null}
      {uploadMessage !== null ? <Alert severity="success">{uploadMessage}</Alert> : null}
      {errorMessage !== null ? <Alert severity="error">{errorMessage}</Alert> : null}
    </>
  );
}

interface WorkspaceContentProps {
  readonly activeView: ViewKey;
  readonly onBitcoinBasisSave: (input: SaveBitcoinBasisProfileInput) => Promise<void>;
  readonly onBitcoinLotSelectionSave: (input: SaveBitcoinLotSelectionInput) => Promise<void>;
  readonly onUpload: (file: File) => Promise<void>;
  readonly snapshot: WorkspaceSnapshot;
}

function WorkspaceContent({
  activeView,
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
