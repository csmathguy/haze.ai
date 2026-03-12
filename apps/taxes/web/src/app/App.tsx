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
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";

import type { WorkspaceSnapshot } from "@taxes/shared";

import { fetchWorkspaceSnapshot, uploadTaxDocument } from "./api.js";
import { DocumentLedger } from "./components/DocumentLedger.js";
import { DocumentUploadPanel } from "./components/DocumentUploadPanel.js";
import { ReviewQueuePanel } from "./components/ReviewQueuePanel.js";
import { StatCard } from "./components/StatCard.js";
import { buildReviewBanner, summarizeRequiredForms } from "./index.js";

type ViewKey = "documents" | "holdings" | "overview" | "scenarios";
const ScenarioPanel = lazy(async () => {
  const module = await import("./components/ScenarioPanel.js");

  return {
    default: module.ScenarioPanel
  };
});

export function App() {
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

  const banner = buildReviewBanner(snapshot);

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
          <WorkspaceAlerts banner={banner} errorMessage={errorMessage} uploadMessage={uploadMessage} />

          <Tabs
            onChange={(_event: SyntheticEvent, value: ViewKey) => {
              setActiveView(value);
            }}
            textColor="primary"
            value={activeView}
            variant="scrollable"
          >
            <Tab icon={<RuleFolderOutlinedIcon />} iconPosition="start" label="Overview" value="overview" />
            <Tab icon={<DescriptionOutlinedIcon />} iconPosition="start" label="Documents" value="documents" />
            <Tab icon={<AssignmentTurnedInOutlinedIcon />} iconPosition="start" label="Review" value="holdings" />
            <Tab icon={<SavingsOutlinedIcon />} iconPosition="start" label="Scenarios" value="scenarios" />
          </Tabs>

          {isBusy || snapshot === null ? (
            <Stack alignItems="center" minHeight={240} justifyContent="center">
              <CircularProgress />
            </Stack>
          ) : (
            <WorkspaceContent activeView={activeView} onUpload={handleUpload} snapshot={snapshot} />
          )}
        </Stack>
      </Container>
    </Box>
  );
}

interface SnapshotViewProps {
  readonly snapshot: WorkspaceSnapshot;
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
            description="Digital asset workflows are activated when crypto data is detected."
            label="Digital assets"
            value={snapshot.household.hasDigitalAssets ? "Enabled" : "Not yet"}
          />
        </Grid>
      </Grid>
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

function ReviewView({ snapshot }: SnapshotViewProps) {
  return (
    <Stack spacing={3}>
      <ReviewQueuePanel reviewQueue={snapshot.reviewQueue} />
      <Alert severity="info">
        Asset-lot tracking is scaffolded but currently empty. The next implementation slice should load holdings, acquisition dates, basis, and disposal history into this workspace.
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
  readonly onUpload: (file: File) => Promise<void>;
  readonly snapshot: WorkspaceSnapshot;
}

function WorkspaceContent({ activeView, onUpload, snapshot }: WorkspaceContentProps) {
  if (activeView === "overview") {
    return <OverviewView onUpload={onUpload} snapshot={snapshot} />;
  }

  if (activeView === "documents") {
    return <DocumentsView onUpload={onUpload} snapshot={snapshot} />;
  }

  if (activeView === "holdings") {
    return <ReviewView snapshot={snapshot} />;
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
